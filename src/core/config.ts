import Constants from 'expo-constants';

/** Single place to rename the app. Keep in sync with "name" in app.json. */
export const APP_NAME = 'WikiSpin';

/** Wikipedia language edition. Only English pools exist today; the setting UI is scaffolded. */
export const DEFAULT_WIKI_LANG = 'en';

/** Contact shown in the User-Agent, as Wikimedia's User-Agent policy asks. Replace before release. */
export const CONTACT = 'philofrog23@gmail.com';

/** Hosted privacy policy (e.g. GitHub Pages copy of PRIVACY.md). Replace before release. */
export const PRIVACY_POLICY_URL = 'https://example.com/wikispin/privacy';

export const CC_BY_SA_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
export const WIKIDATA_CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export const USER_AGENT = `${APP_NAME}/${APP_VERSION} (${CONTACT})`;
