// Vercel function entry. It only re-exports the bundle built by `npm run build:vercel`, so
// Vercel never has to compile the TypeScript sources itself.
export { default } from "../dist/vercelHandler.js";
