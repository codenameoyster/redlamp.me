declare module '*.py' { const text: string; export default text; }
// scripts/build.ts sets the version from package.json.
declare const __APP_VERSION__: string;
