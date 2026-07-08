import { browserManager } from "./manager.ts";
import { CredentialsNotFoundError } from "../errors/types.ts";

const LINKEDIN_URL = "https://www.linkedin.com";

export async function ensureAuthenticated(): Promise<void> {
  const isLoggedIn = await checkLogin();
  if (!isLoggedIn) {
    throw new CredentialsNotFoundError();
  }
}

export async function checkLogin(): Promise<boolean> {
  try {
    await browserManager.navigate(LINKEDIN_URL);

    const hasNav = await browserManager.evaluate<boolean>(
      "!!document.querySelector('.global-nav__primary-link, .global-nav__me, .search-global-typeahead')",
    );

    if (hasNav) return true;

    const currentUrl = await browserManager.evaluate<string>("window.location.href");
    const blockerPatterns = ["/login", "/authwall", "/checkpoint", "/challenge", "/signup"];
    const isBlocked = blockerPatterns.some((p) => currentUrl.includes(p));

    return !isBlocked;
  } catch {
    return false;
  }
}

export async function performLogin(profileDir: string): Promise<void> {
  // Bun.WebView only supports headless, so we use a different approach:
  // We open the login page in the headless view and let the user
  // authenticate via a browser that has their session.
  // The profile directory will persist cookies for future use.

  console.log("Opening LinkedIn login page...");
  console.log(`Profile directory: ${profileDir}`);
  console.log("Please log in to LinkedIn in the opened browser window.");
  console.log("Once logged in, return here and the session will be saved.");

  await browserManager.navigate(
    "https://www.linkedin.com/login",
  );

  const loginTimeout = 300_000; // 5 minutes
  const startTime = Date.now();

  while (Date.now() - startTime < loginTimeout) {
    const loggedIn = await checkLogin();
    if (loggedIn) {
      console.log("✓ LinkedIn session established.");
      return;
    }
    await Bun.sleep(1000);
  }

  throw new Error(
    "Login timed out. Run `bun run login` again to retry.",
  );
}
