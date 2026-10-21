import { isAxiosError } from "axios";

// Turns any thrown value (axios error, Error, string) into a message that is
// safe to show to the user.
export const getErrorMessage = (err: unknown, fallback = "Something went wrong. Please try again."): string => {
  if (!err) return fallback;
  if (typeof err === "string") return err;

  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: unknown; error?: unknown } | undefined;
    if (typeof data?.message === "string" && data.message) return data.message;
    if (typeof data?.error === "string" && data.error) return data.error;

    if (err.code === "ECONNABORTED") return "The request timed out. Please try again.";
    if (!err.response) return "Unable to reach the server. Check your connection and try again.";
    if (err.response.status >= 500) return "The server ran into a problem. Please try again later.";
    // Axios's own messages ("Request failed with status code 404") aren't user friendly.
    return fallback;
  }

  if (err instanceof Error && err.message) return err.message;
  return fallback;
};
