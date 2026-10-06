#!/usr/bin/env python3
"""Copy a stable, filtered source snapshot into an already clean-installed fixture."""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import os
import shutil

ROOT = Path('/Users/solvia/Documents/cowork/html-boilerplate')
REPORT_ROOT = ROOT / 'qa/framework-status-2026-10-05/integration'
EXCLUDED = {'.git', 'node_modules', 'dist', '.generated', '.agents', '.codex', '.aws'}

def excluded(parts):
    return parts[0] == 'release' or any(part in EXCLUDED or part.startswith('.env') for part in parts) or (
        parts[0] == 'qa' and len(parts) > 1 and
        (parts[1].startswith('framework-status-') or parts[1].startswith('framework-acceptance'))
    )

def digest(filename):
    return hashlib.sha256(filename.read_bytes()).hexdigest()

def inventory(base):
    items = {}
    for directory, directories, filenames in os.walk(base, followlinks=False):
        directory = Path(directory)
        directories[:] = sorted(name for name in directories if not excluded((directory / name).relative_to(base).parts))
        for name in sorted(filenames):
            absolute = directory / name
            relative = absolute.relative_to(base)
            if excluded(relative.parts):
                continue
            if absolute.is_symlink():
                raise RuntimeError(f'Unexpected source symlink: {relative}')
            items[str(relative)] = {'sha256': digest(absolute), 'bytes': absolute.stat().st_size}
    return items

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--fixture', required=True)
    parser.add_argument('--label', required=True)
    args = parser.parse_args()
    fixture = Path(args.fixture).resolve()
    if fixture.parent != Path('/private/tmp') or not fixture.name.startswith('framework-clean-install-'):
        raise RuntimeError('Fixture must be the task-owned clean-install directory in /private/tmp')
    dependency_directory = fixture / 'node_modules'
    if dependency_directory.is_symlink() or not dependency_directory.is_dir():
        raise RuntimeError('Expected real installed fixture node_modules')
    dependency_inode = dependency_directory.stat().st_ino
    previous_package = json.loads((fixture / 'package.json').read_text())
    current_package = json.loads((ROOT / 'package.json').read_text())
    for key in ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'resolutions']:
        if previous_package.get(key) != current_package.get(key):
            raise RuntimeError(f'Dependency field changed; frozen reinstall required: {key}')
    if digest(fixture / 'yarn.lock') != digest(ROOT / 'yarn.lock'):
        raise RuntimeError('Yarn lock changed; frozen reinstall required')
    before = inventory(ROOT)
    old_fixture = inventory(fixture)
    stale = sorted(set(old_fixture) - set(before))
    if stale:
        raise RuntimeError('Stale source files in fixture: ' + ', '.join(stale))
    changed = sorted(relative for relative, metric in before.items() if old_fixture.get(relative) != metric)
    for relative, metric in before.items():
        source = ROOT / relative
        if digest(source) != metric['sha256']:
            raise RuntimeError(f'Source changed during copy: {relative}')
        target = fixture / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        if digest(target) != metric['sha256']:
            raise RuntimeError(f'Copied bytes differed: {relative}')
    after = inventory(ROOT)
    changes_during_copy = sorted(set(before) ^ set(after) | {key for key in set(before) & set(after) if before[key] != after[key]})
    if dependency_directory.stat().st_ino != dependency_inode:
        raise RuntimeError('Fixture dependency directory changed during overlay')
    report = {
        'recordedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'fixture': str(fixture), 'fileCount': len(before), 'copiedChanges': changed,
        'sourceChangesDuringCopy': changes_during_copy,
        'dependenciesPreserved': True, 'yarnLockUnchanged': True,
        'snapshotSha256': hashlib.sha256(json.dumps(before, sort_keys=True, separators=(',', ':')).encode()).hexdigest(),
        'files': before,
    }
    destination = REPORT_ROOT / f'{args.label}.json'
    destination.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'files'}, indent=2))
    if changes_during_copy:
        raise RuntimeError('Source changed during overlay; fixture must not be accepted')

if __name__ == '__main__':
    main()
