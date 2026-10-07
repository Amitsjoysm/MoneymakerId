# Source this file (". .claude/hooks/registry-proxy-env.sh") in a Claude Code cloud session.
# Cloud containers list the package registries in NO_PROXY, which sends them around the agent proxy
# to a direct route that the egress policy blocks. When the proxy can reach the npm registry, this
# removes the registries from the NO_PROXY variables so npm/pnpm/pip/uv go through the proxy,
# which is the policy-enforcing path. It is a no-op anywhere else.
if [ -n "${HTTPS_PROXY:-}" ] && curl -sS --max-time 10 --noproxy '' -x "$HTTPS_PROXY" -o /dev/null -w '%{http_code}' https://registry.npmjs.org/ 2>/dev/null | grep -q '^200$'; then
  _mm_strip() { printf '%s' "$1" | tr ',' '\n' | grep -v -E '^(registry\.npmjs\.org|pypi\.org|files\.pythonhosted\.org|jsr\.io|npm\.jsr\.io)$' | paste -sd, -; }
  export NO_PROXY="$(_mm_strip "${NO_PROXY:-}")" no_proxy="$(_mm_strip "${no_proxy:-}")"
  export npm_config_noproxy="$(_mm_strip "${npm_config_noproxy:-}")" GLOBAL_AGENT_NO_PROXY="$(_mm_strip "${GLOBAL_AGENT_NO_PROXY:-}")"
  unset -f _mm_strip
  MM_REGISTRY_VIA_PROXY=1
fi
