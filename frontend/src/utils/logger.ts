/** console.log that only fires in dev mode (import.meta.env.DEV) */
export const devLog: typeof console.log = import.meta.env.DEV
  ? console.log.bind(console)
  : () => {};
