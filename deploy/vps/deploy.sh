#!/bin/bash
set -euo pipefail
export PATH=/usr/bin:/bin
umask 022

sha=${SSH_ORIGINAL_COMMAND:-}
if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "Expected a 40-character Git commit SHA." >&2
    exit 1
fi

repo=https://github.com/bofandra/simrs-api.git
root=/opt/simrs-api/app
release="$root/releases/$sha"
health_url=http://127.0.0.1:4010/healthz

exec 9>"$root/deploy.lock"
flock -w 60 9

head=$(git ls-remote --exit-code "$repo" refs/heads/main)
if [[ "${head%%$'\t'*}" != "$sha" ]]; then
    echo "Skipping $sha because main has advanced."
    exit 0
fi

healthy() {
    systemctl is-active --quiet simrs-api.service &&
        curl --fail --silent --max-time 2 "$health_url" |
        /opt/simrs-api/node -e '
            const health = JSON.parse(require("node:fs").readFileSync(0, "utf8") || "{}");
            process.exit(health.service === "simrs-api" &&
                health.mode === "synthetic-mock" && health.status === "ok" ? 0 : 1);
        '
}

wait_for_health() {
    for ((attempt = 1; attempt <= 20; attempt++)); do
        healthy && return 0
        sleep 1
    done
    return 1
}

previous=$(readlink "$root/current" || true)
if [[ "$previous" == "$release" ]] && healthy; then
    echo "$sha is already running and healthy."
    exit 0
fi

stage=$(mktemp -d "$root/releases/.deploy.XXXXXXXX")
switched=false

activate() {
    ln -sfn -- "$1" "$stage/current" &&
        mv -Tf -- "$stage/current" "$root/current"
}

cleanup() {
    local status=$?
    trap - EXIT
    if [[ "$switched" == true ]]; then
        if [[ -n "$previous" && "$previous" != "$release" ]]; then
            echo "Restoring ${previous##*/}." >&2
            if ! activate "$previous" ||
                ! sudo -n /usr/bin/systemctl restart simrs-api.service ||
                ! wait_for_health; then
                echo "Previous release did not recover. Inspect simrs-api.service on the VPS." >&2
            fi
        elif [[ -z "$previous" ]]; then
            rm -f -- "$root/current"
            sudo -n /usr/bin/systemctl stop simrs-api.service || true
        fi
    fi
    rm -rf -- "$stage"
    exit "$status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM

if [[ ! -d "$release" ]]; then
    curl --fail --silent --show-error --retry 2 --max-time 30 \
        "https://codeload.github.com/bofandra/simrs-api/tar.gz/$sha" -o "$stage/source.tar.gz"
    mkdir -m 0755 "$stage/source"
    tar -xzf "$stage/source.tar.gz" --strip-components=1 \
        --no-same-owner --no-same-permissions -C "$stage/source"
    /opt/simrs-api/node --check "$stage/source/mock-server.mjs"
    mv -T -- "$stage/source" "$release"
fi

switched=true
activate "$release"
sudo -n /usr/bin/systemctl restart simrs-api.service
if ! wait_for_health; then
    echo "Health check failed for $sha." >&2
    exit 1
fi
switched=false

find "$root/releases" -mindepth 1 -maxdepth 1 -regextype posix-extended -type d \
    -regex '.*/[0-9a-f]{40}' ! -path "$release" ! -path "$previous" -exec rm -rf -- {} +
echo "Deployed $sha"
curl --fail --silent --show-error --max-time 2 "$health_url"
printf '\n'
