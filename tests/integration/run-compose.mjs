import { spawnSync } from 'node:child_process';
import process from 'node:process';

const project = 'falae-integration';
const baseArgs = ['compose', '-p', project, '--profile', 'integration'];
const up = spawnSync(
  'docker',
  [
    ...baseArgs,
    'up',
    '--build',
    '--abort-on-container-exit',
    '--exit-code-from',
    'integration-tests',
    'integration-tests',
  ],
  { stdio: 'inherit' },
);

const down = spawnSync(
  'docker',
  [...baseArgs, 'down', '--volumes', '--remove-orphans'],
  { stdio: 'inherit' },
);

if (up.error) throw up.error;
if (down.error) throw down.error;

const upStatus = up.status ?? 1;
const downStatus = down.status ?? 1;
process.exitCode = upStatus === 0 ? downStatus : upStatus;
