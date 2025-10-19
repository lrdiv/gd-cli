import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { stdin as input, stdout as output } from "node:process";
import inquirer from "inquirer";
import { GratefulDeadArchiveClient } from "../services/grateful-dead-archive.js";
import type { ArchiveShow } from "../services/grateful-dead-archive.js";

interface ShowCommandOptions {
  auto?: boolean;
}

interface ShowWorkflowConfig {
  auto: boolean;
  fetchShows: (
    client: GratefulDeadArchiveClient
  ) => Promise<ArchiveShow[]>;
}

export function registerShows(program: Command) {
  program
    .command("shows")
    .description(
      "Fetch Grateful Dead shows that happened on a specific date and open one in your browser"
    )
    .argument("<date>", "Calendar date in YYYY-MM-DD format")
    .option(
      "-a, --auto",
      "Automatically open the first show without prompting",
      false
    )
    .action(async (dateArg: string, options: ShowCommandOptions) => {
      try {
        const targetDate = parseDateArgument(dateArg);
        await runShowWorkflow({
          auto: options.auto ?? false,
          fetchShows: (client) => client.getShowsForDate(targetDate),
        });
      } catch (error) {
        console.error(chalk.red((error as Error).message));
        process.exitCode = 1;
      }
    });
}

export function registerToday(program: Command) {
  program
    .command("today")
    .description(
      "Fetch Grateful Dead shows that happened on today's date and open one in your browser"
    )
    .option(
      "-a, --auto",
      "Automatically open the first show without prompting",
      false
    )
    .action(async (options: ShowCommandOptions) => {
      try {
        await runShowWorkflow({
          auto: options.auto ?? false,
          fetchShows: (client) => client.getShowsForToday(),
        });
      } catch (error) {
        console.error(chalk.red((error as Error).message));
        process.exitCode = 1;
      }
    });
}

async function runShowWorkflow({
  auto,
  fetchShows,
}: ShowWorkflowConfig): Promise<void> {
  const client = new GratefulDeadArchiveClient();
  const spinner = ora("Fetching shows from archive.org...").start();

  let shows: ArchiveShow[];
  try {
    shows = await fetchShows(client);
  } catch (error) {
    spinner.fail("Failed to fetch shows");
    throw error;
  }

  const groupedShows = groupShowsByDate(shows);
  const recordingLabel =
    shows.length === 1 ? "1 recording" : `${shows.length} recordings`;
  const dayLabel =
    groupedShows.length === 1 ? "1 day" : `${groupedShows.length} days`;
  spinner.succeed(`Found ${recordingLabel} on ${dayLabel}`);

  if (shows.length === 0) {
    console.log(chalk.yellow("No shows found for that date."));
    return;
  }

  if (auto || !input.isTTY || !output.isTTY) {
    await openShow(client, shows[0]);
    return;
  }

  const selectedGroup = await promptForDateSelection(groupedShows);

  if (!selectedGroup) {
    console.log(chalk.gray("No selection made. Exiting."));
    return;
  }

  const selection = await promptForShowSelection(selectedGroup);

  if (selection.kind === "cancel") {
    console.log(chalk.gray("No selection made. Exiting."));
    return;
  }

  await openShow(client, selection.show);
  return;
}

function parseDateArgument(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(
      `Invalid date format. Use YYYY-MM-DD (received "${value}")`
    );
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date provided: "${value}"`);
  }

  return date;
}

async function openShow(
  client: GratefulDeadArchiveClient,
  show: Awaited<
    ReturnType<GratefulDeadArchiveClient["getShowsForToday"]>
  >[number]
) {
  const spinner = ora(
    `Opening ${show.title} (${show.date}) in your browser...`
  ).start();
  try {
    await client.openShowInBrowser(show);
    spinner.succeed(`Opened ${chalk.green(show.title)} — ${show.date}`);
  } catch (error) {
    spinner.fail("Failed to open the show in the browser");
    throw error;
  }
}

function groupShowsByDate(
  shows: ArchiveShow[]
): Array<{ date: string; shows: ArchiveShow[] }> {
  const groups = new Map<string, ArchiveShow[]>();

  for (const show of shows) {
    const existing = groups.get(show.date);
    if (existing) {
      existing.push(show);
    } else {
      groups.set(show.date, [show]);
    }
  }

  return Array.from(groups.entries())
    .map(([date, groupedShows]) => ({
      date,
      shows: groupedShows.sort((a, b) => {
        const ratingA =
          typeof a.avgRating === "number" && Number.isFinite(a.avgRating)
            ? a.avgRating
            : Number.NEGATIVE_INFINITY;
        const ratingB =
          typeof b.avgRating === "number" && Number.isFinite(b.avgRating)
            ? b.avgRating
            : Number.NEGATIVE_INFINITY;

        if (ratingA !== ratingB) {
          return ratingB - ratingA;
        }

        return a.title.localeCompare(b.title);
      }),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function promptForDateSelection(
  groups: Array<{ date: string; shows: ArchiveShow[] }>
): Promise<{ date: string; shows: ArchiveShow[] } | null> {
  const cancelToken = "__cancel__";
  const choices = [
    ...groups.map((group) => ({
      name: formatGroupLabel(group),
      value: group.date,
    })),
    { name: "Cancel", value: cancelToken },
  ];

  const { selectedDate } = await inquirer.prompt<{
    selectedDate: string;
  }>([
    {
      type: "list",
      name: "selectedDate",
      message: "Select a date to explore recordings:",
      loop: false,
      choices,
    },
  ]);

  if (selectedDate === cancelToken) {
    return null;
  }

  return groups.find((group) => group.date === selectedDate) ?? null;
}

async function promptForShowSelection(group: {
  date: string;
  shows: ArchiveShow[];
}): Promise<
  | { kind: "show"; show: ArchiveShow }
  | { kind: "cancel" }
> {
  const cancelToken = "__cancel__";
  const choices = [
    ...group.shows.map((show) => ({
      name: formatShowLabel(show),
      value: show.identifier,
    })),
    { name: "Cancel", value: cancelToken },
  ];

  const { selectedId } = await inquirer.prompt<{ selectedId: string }>([
    {
      type: "list",
      name: "selectedId",
      message: `Select a recording from ${group.date}:`,
      loop: false,
      choices,
    },
  ]);

  if (selectedId === cancelToken) {
    return { kind: "cancel" };
  }

  const show =
    group.shows.find((candidate) => candidate.identifier === selectedId) ??
    null;

  if (!show) {
    return { kind: "cancel" };
  }

  return { kind: "show", show };
}

function formatGroupLabel(group: {
  date: string;
  shows: ArchiveShow[];
}): string {
  const countLabel =
    group.shows.length === 1
      ? "1 recording"
      : `${group.shows.length} recordings`;
  const venueDetails = summarizeGroupVenues(group.shows);
  const locationDetails = summarizeGroupLocations(group.shows);

  const detailParts = [venueDetails, locationDetails].filter(Boolean);
  const detailLabel = detailParts.join(" — ");

  return detailLabel
    ? `${group.date} — ${detailLabel} (${countLabel})`
    : `${group.date} (${countLabel})`;
}

function formatShowLabel(show: ArchiveShow): string {
  const parts: string[] = [];
  const venue = show.venue?.trim();
  if (venue) {
    parts.push(venue);
  }

  const location = getShowCityState(show);
  if (location) {
    parts.push(location);
  }

  parts.push(show.recordingType ?? "Unknown source");

  const rating = formatAverageRating(show.avgRating, show.numRatings);
  parts.push(rating ?? "Avg rating N/A");

  return parts.join(" — ");
}

function formatAverageRating(
  rating: number | undefined,
  count: number | undefined
): string | undefined {
  if (rating === undefined || Number.isNaN(rating)) {
    return undefined;
  }

  if (count === undefined || Number.isNaN(count)) {
    return `Avg rating ${rating.toFixed(1)}`;
  }

  const normalizedCount = Math.max(0, Math.trunc(count));
  const countLabel =
    normalizedCount === 1
      ? "1 rating"
      : `${normalizedCount} ratings`;

  return `Avg rating ${rating.toFixed(1)} (${countLabel})`;
}

function summarizeGroupVenues(shows: ArchiveShow[]): string | undefined {
  const uniqueVenues = Array.from(
    new Set(
      shows
        .map((show) => show.venue?.trim())
        .filter((venue): venue is string => Boolean(venue))
    )
  );

  if (uniqueVenues.length === 0) {
    return undefined;
  }

  if (uniqueVenues.length === 1) {
    return uniqueVenues[0];
  }

  return undefined;
}

function summarizeGroupLocations(shows: ArchiveShow[]): string | undefined {
  const uniqueLocations = Array.from(
    new Set(
      shows
        .map(getShowCityState)
        .filter((location): location is string => Boolean(location))
    )
  );

  if (uniqueLocations.length === 0) {
    return undefined;
  }

  return uniqueLocations.join(" • ");
}

function getShowCityState(show: ArchiveShow): string | undefined {
  const coverage = show.coverage?.trim();

  if (!coverage) {
    return undefined;
  }

  const normalized = coverage.replace(/\s+/g, " ");

  if (!normalized) {
    return undefined;
  }

  const segments = normalized
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return undefined;
  }

  if (segments.length === 1) {
    return segments[0];
  }

  const [city, ...rest] = segments;
  const stateAndBeyond = rest.join(", ");

  if (!city) {
    return stateAndBeyond || undefined;
  }

  return stateAndBeyond ? `${city}, ${stateAndBeyond}` : city;
}
