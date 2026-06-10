import { useWebSocket, fetchInitialState, isStateSnapshot, isStatePatch, isShowPatch, applyStatePatch, applyShowPatch } from "../useShowState";
import type { ConnectionState } from "../useShowState";
import type { PerformanceState } from "../../types";
import { localizeScreenRouteTarget, formatOwner } from "../lib/helpers";
import { useState, useEffect, memo } from "react";

interface ScreenGatewayProps {
  screenId: string;
}

export const ScreenGateway = memo(function ScreenGateway({ screenId }: ScreenGatewayProps) {
  const [snapshot, setSnapshot] = useState<PerformanceState | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [message, setMessage] = useState("Resolving route");

  const route = snapshot?.modules.interaction.screenRoutes?.[screenId];
  const screenPresentation = snapshot?.modules.interaction.screenPresentation || {
    autoRedirect: true,
    cameraEnabled: false,
    showDebug: false,
    showMenu: false
  };
  const routeTargetUrl = localizeScreenRouteTarget(route?.url || null, route?.owner);

  useEffect(() => {
    let closed = false;
    fetchInitialState()
      .then((state) => { if (!closed) setSnapshot(state); })
      .catch(() => { if (!closed) { setConnection("offline"); setMessage("4300 API unavailable"); } });
    return () => { closed = true; };
  }, []);

  useWebSocket(
    `screen-gateway-${screenId}`,
    ["state.read", "screen.route"],
    (message) => {
      if (isStateSnapshot(message)) setSnapshot(message.state);
      if (isStatePatch(message)) {
        setSnapshot((current) => message.state || (current ? applyStatePatch(current, message) : current));
      }
      if (isShowPatch(message)) {
        setSnapshot((current) => current ? applyShowPatch(current, message) : current);
      }
    },
    setConnection
  );

  useEffect(() => {
    if (!snapshot) return;
    if (!route) {
      setMessage(`Unknown screen ${screenId}`);
      return;
    }
    if (!screenPresentation.autoRedirect) {
      setMessage(`Manual routing hold for ${formatOwner(route.owner)}`);
      return;
    }
    if (routeTargetUrl && route.owner !== "off" && route.owner !== "diagnostic") {
      setMessage(`Routing ${screenId} to ${formatOwner(route.owner)}`);
      window.location.replace(routeTargetUrl);
      return;
    }
    setMessage(route.owner === "diagnostic" ? "Diagnostic hold" : "Route URL unavailable");
  }, [route, routeTargetUrl, screenId, screenPresentation.autoRedirect, snapshot]);

  return (
    <main className="screen-gateway">
      <section>
        <div className="flex items-center gap-3 mb-3">
          <div className={`connection-dot ${connection}`} />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{connection}</span>
        </div>
        <h1>{screenId}</h1>
        <p>{message}</p>
        {route && (
          <dl>
            <div>
              <dt>Owner</dt>
              <dd>{formatOwner(route.owner)}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>{route?.url || "Route URL unavailable"}</dd>
            </div>
            <div>
              <dt>Auto Redirect</dt>
              <dd>{screenPresentation.autoRedirect ? "enabled" : "disabled"}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{new Date(route.updatedAt).toLocaleTimeString()}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  );
});
