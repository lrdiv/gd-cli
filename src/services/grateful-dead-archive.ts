import { spawn } from "node:child_process";

export interface ArchiveShow {
  identifier: string;
  title: string;
  date: string;
  venue?: string;
  coverage?: string;
  source?: string;
  avgRating?: number;
  numRatings?: number;
  recordingType?: "SBD" | "AUD" | "MTX";
  url: string;
}

interface ArchiveResponse {
  response: {
    docs: Array<{
      identifier: string;
      title?: string;
      date?: string;
      venue?: string;
      coverage?: string;
      source?: string;
      avg_rating?: number | string;
      num_reviews?: number | string;
    }>;
  };
}

export class GratefulDeadArchiveClient {
  private readonly baseUrl = "https://archive.org/advancedsearch.php";
  private readonly collection = "GratefulDead";
  private readonly artist = '"Grateful Dead"';

  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  /**
   * Fetches shows for the provided date (defaults to today) where the artist is Grateful Dead.
   * The Archive API does not support direct month/day-only queries reliably, so the results are
   * filtered locally to ensure they match the requested calendar day across all years.
   */
  async getShowsForDate(date: Date = new Date()): Promise<ArchiveShow[]> {
    const { month, day } = this.toMonthDay(date);
    const searchUrl = this.buildSearchUrl(month, day);
    const response = await this.fetchImpl(searchUrl);

    if (!response.ok) {
      throw new Error(
        `Archive API request failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as ArchiveResponse & {
      error?: string;
    };

    if (payload.error) {
      throw new Error(`Archive API error: ${payload.error}`);
    }

    if (!payload.response) {
      throw new Error("Archive API response did not include any results");
    }

    const docs = payload.response.docs ?? [];

    return docs
      .filter((doc) => {
        const docDate = doc.date ?? "";
        // The archive stores dates as YYYY-MM-DD. We keep anything matching today's MM-DD.
        return docDate.includes(`-${month}-${day}`);
      })
      .map((doc) => {
        const identifier = doc.identifier;
        const title = doc.title ?? identifier;
        const showDate = this.normalizeArchiveDate(doc.date);
        const venue = doc.venue;
        const coverage = doc.coverage;
        const source = doc.source;
        const avgRating =
          doc.avg_rating === undefined
            ? undefined
            : Number.parseFloat(String(doc.avg_rating)) || undefined;
        const numRatings =
          doc.num_reviews === undefined
            ? undefined
            : Number.parseInt(String(doc.num_reviews), 10);

        return {
          identifier,
          title,
          date: showDate,
          venue,
          coverage,
          source,
          avgRating,
          numRatings,
          recordingType: this.detectRecordingType({
            identifier,
            title,
            source,
          }),
          url: this.buildDetailsUrl(identifier),
        };
      });
  }

  /**
   * Convenience method for today's shows.
   */
  async getShowsForToday(): Promise<ArchiveShow[]> {
    return this.getShowsForDate(new Date());
  }

  /**
   * Opens the show in the user's default browser using platform-specific commands.
   */
  async openShowInBrowser(
    show: Pick<ArchiveShow, "url"> | string,
  ): Promise<void> {
    const url = typeof show === "string" ? show : show.url;

    return new Promise((resolve, reject) => {
      let command: string;
      let args: string[];
      const options = { stdio: "ignore" as const, detached: true };

      switch (process.platform) {
        case "darwin":
          command = "open";
          args = [url];
          break;
        case "win32":
          command = "cmd";
          args = ["/c", "start", "", url];
          break;
        default:
          command = "xdg-open";
          args = [url];
      }

      const child = spawn(command, args, options);

      child.on("error", (error) => reject(error));
      child.on("close", (code) => {
        if (code === 0 || command === "cmd") {
          resolve();
        } else {
          reject(new Error(`Failed to open browser (exit code ${code})`));
        }
      });

      child.unref();
    });
  }

  private toMonthDay(date: Date): { month: string; day: string } {
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return { month, day };
  }

  private buildSearchUrl(month: string, day: string): string {
    const yearFilters: string[] = [];
    for (let year = 1965; year <= 1995; year += 1) {
      yearFilters.push(`date:${year}-${month}-${day}`);
    }
    const dateFilter = `(${yearFilters.join(" OR ")})`;

    const params = new URLSearchParams();
    params.set(
      "q",
      `collection:(${this.collection}) AND creator:${this.artist} AND ${dateFilter}`,
    );
    params.append("fl[]", "identifier");
    params.append("fl[]", "title");
    params.append("fl[]", "date");
    params.append("fl[]", "venue");
    params.append("fl[]", "coverage");
    params.append("fl[]", "source");
    params.append("fl[]", "avg_rating");
    params.append("fl[]", "num_reviews");
    params.append("fl[]", "files");
    params.append("sort[]", "date asc");
    params.set("rows", "500");
    params.set("page", "1");
    params.set("output", "json");

    return `${this.baseUrl}?${params.toString()}`;
  }

  private buildDetailsUrl(identifier: string): string {
    return `https://archive.org/details/${encodeURIComponent(identifier)}`;
  }

  private detectRecordingType(details: {
    identifier: string;
    title?: string;
    source?: string;
  }): "SBD" | "AUD" | "MTX" | undefined {
    const segments = [details.identifier, details.title, details.source]
      .filter((segment): segment is string =>
        Boolean(segment && segment.trim()),
      )
      .map((segment) => segment.toLowerCase());

    if (segments.length === 0) {
      return undefined;
    }

    if (
      segments.some(
        (segment) => /\bmtx\b/.test(segment) || segment.includes("matrix"),
      )
    ) {
      return "MTX";
    }

    if (
      segments.some(
        (segment) => /\bsbd\b/.test(segment) || segment.includes("soundboard"),
      )
    ) {
      return "SBD";
    }

    if (
      segments.some(
        (segment) => /\baud\b/.test(segment) || segment.includes("audience"),
      )
    ) {
      return "AUD";
    }

    return undefined;
  }

  private normalizeArchiveDate(rawDate: string | undefined): string {
    if (!rawDate) {
      return "Unknown date";
    }

    const trimmed = rawDate.trim();
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);

    if (match) {
      return match[1];
    }

    const parsed = Date.parse(trimmed);

    if (Number.isNaN(parsed)) {
      return trimmed;
    }

    return new Date(parsed).toISOString().slice(0, 10);
  }
}
