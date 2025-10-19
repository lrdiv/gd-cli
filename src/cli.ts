#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { execa } from 'execa';
import pkg from '../package.json' assert { type: 'json' };
import { registerShows, registerToday } from './commands/shows.js';

const program = new Command();

program
  .name(pkg.name)
  .description(pkg.description)
  .version(pkg.version);

// Global option example
program.option('-v, --verbose', 'Enable verbose logging', false);

// Register commands
registerShows(program);
registerToday(program);

program
  .command('info')
  .description('Show environment info')
  .action(async () => {
    const spinner = ora('Collecting environment info...').start();
    try {
      const [node, npm, git] = await Promise.all([
        execa('node', ['-v']).catch(() => ({ stdout: 'not found' } as any)),
        execa('npm', ['-v']).catch(() => ({ stdout: 'not found' } as any)),
        execa('git', ['--version']).catch(() => ({ stdout: 'not found' } as any))
      ]);

      spinner.succeed('Environment info collected');
      console.log(
        [
          `${chalk.cyan('Node')}: ${chalk.bold(node.stdout)}`,
          `${chalk.cyan('npm')}: ${chalk.bold(npm.stdout)}`,
          `${chalk.cyan('git')}: ${chalk.bold(git.stdout)}`
        ].join('\n')
      );
    } catch (err) {
      spinner.fail('Failed to collect info');
      console.error(chalk.red((err as Error).message));
      process.exitCode = 1;
    }
  });

// Show help when no args are provided
if (process.argv.length <= 2) {
  program.outputHelp();
} else {
  program.parseAsync();
}
