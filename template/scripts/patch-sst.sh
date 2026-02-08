#!/usr/bin/env bash
# Patches SST's Vpc.get() panic when the referenced VPC uses nat: "ec2" + bastion: true
# Tracking issue: https://github.com/sst/sst/issues/6360
# Remove this script once SST ships the fix.

set -euo pipefail

npx sst install

python3 << 'PATCH'
import re

f = '.sst/platform/src/components/aws/vpc.ts'
with open(f) as fh:
    s = fh.read()

s = re.sub(
    r'ip: self\.natInstances\.apply\(\(instances\) =>\n\s+instances\.length \? elasticIps\[0\]\?\.publicIp : bastion\.publicIp,\n\s+\),',
    'ip: elasticIps[0]?.publicIp ?? bastion.publicIp,',
    s,
)

with open(f, 'w') as fh:
    fh.write(s)
PATCH
