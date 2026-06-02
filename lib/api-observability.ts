import { logError, logInfo } from "@/lib/logger";

type RouteHandler = (req: Request, context?: any) => Promise<Response>;

export function loggedRoute(route: string, handler: RouteHandler): RouteHandler {
  return async (req, context) => {
    const started = Date.now();

    try {
      const response = await handler(req, context);
      logInfo("api.request", {
        route,
        method: req.method,
        status: response.status,
        durationMs: Date.now() - started,
      });
      return response;
    } catch (error) {
      logError("api.request", {
        route,
        method: req.method,
        durationMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}
