interface RequestForLogging {
  method: string;
  routeOptions?: { url?: string };
}

export function privacySafeRequestSerializer(request: RequestForLogging) {
  return {
    method: request.method,
    route: request.routeOptions?.url ?? "unmatched",
  };
}
