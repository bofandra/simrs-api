#!/bin/bash
set -euo pipefail

if [[ "$EUID" != 0 || "$#" != 1 || "$(uname -m)" != x86_64 ]]; then
    echo "Usage on Ubuntu x86_64: sudo bash deploy/vps/install.sh /path/to/deploy_key.pub" >&2
    exit 1
fi

read -r key_type key_data _ < "$1"
if [[ "$key_type" != ssh-ed25519 || ! "$key_data" =~ ^[A-Za-z0-9+/]+={0,2}$ ]]; then
    echo "Expected an Ed25519 SSH public key." >&2
    exit 1
fi
ssh-keygen -lf "$1" >/dev/null

files=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
base=/opt/simrs-api
deploy_user=simrs-api-deploy
deploy_home=/var/lib/simrs-api-deploy
version=22.23.5
archive="node-v$version-linux-x64.tar.xz"
checksum=cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT

install -d -m 0755 "$base" /usr/local/libexec
if [[ ! -x "$base/node-v$version" ]]; then
    curl --fail --silent --show-error --retry 2 --max-time 60 \
        "https://nodejs.org/dist/v$version/$archive" -o "$stage/$archive"
    (cd "$stage" && printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check)
    tar -xJf "$stage/$archive" --strip-components=2 -C "$stage" "node-v$version-linux-x64/bin/node"
    install -m 0755 "$stage/node" "$base/node-v$version"
fi
ln -sfn "node-v$version" "$base/node"

if ! id simrs-api >/dev/null 2>&1; then
    useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin simrs-api
fi
if ! id "$deploy_user" >/dev/null 2>&1; then
    useradd --system --user-group --no-create-home --home-dir "$deploy_home" --shell /bin/bash "$deploy_user"
fi
install -d -m 0755 "$deploy_home" "$deploy_home/.ssh"
install -d -o "$deploy_user" -g "$deploy_user" -m 0755 "$base/app" "$base/app/releases"

cat > "$stage/sudoers" <<'EOF'
simrs-api-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart simrs-api.service, /usr/bin/systemctl stop simrs-api.service
EOF
visudo -cf "$stage/sudoers"
install -m 0440 "$stage/sudoers" /etc/sudoers.d/simrs-api-deploy
install -m 0755 "$files/deploy.sh" /usr/local/libexec/simrs-api-deploy
install -m 0644 "$files/simrs-api.service" /etc/systemd/system/simrs-api.service
systemctl daemon-reload
systemctl enable simrs-api.service

printf 'restrict,command="/usr/local/libexec/simrs-api-deploy" %s %s github-actions-simrs-api\n' \
    "$key_type" "$key_data" > "$stage/authorized_keys"
install -m 0644 "$stage/authorized_keys" "$deploy_home/.ssh/authorized_keys"
