import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import rspack from "@rspack/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontWeights = "{Regular,Italic,Bold,BoldItalic,SemiBold,ExtraBold}";

export default (env, argv) => {
	const isDev = argv.mode !== "production";

	return {
		mode: isDev ? "development" : "production",
		entry: { main: "./src/app.js" },
		output: {
			path: path.resolve(__dirname, "dist"),
			publicPath: "/",
			clean: true,
		},
		plugins: [
			new rspack.HtmlRspackPlugin({
				template: "./src/index.html",
				scriptLoading: "defer",
				favicon: "./src/assets/favicon.svg",
			}),
			new rspack.CopyRspackPlugin({
				patterns: [
					{ from: "src/styles", to: "styles" },
					{
						from: "src/assets/iosevka/Iosevka.css",
						to: "assets/iosevka/Iosevka.css",
					},
					{
						from: "src/assets/iosevka_aile/IosevkaAile.css",
						to: "assets/iosevka_aile/IosevkaAile.css",
					},
					{
						from: `Iosevka-${fontWeights}.woff2`,
						context: "src/assets/iosevka/WOFF2",
						to: "assets/iosevka/WOFF2",
					},
					{
						from: `IosevkaAile-${fontWeights}.woff2`,
						context: "src/assets/iosevka_aile/WOFF2",
						to: "assets/iosevka_aile/WOFF2",
					},
					{
						from: "oauth-client-metadata.json",
						to: "oauth-client-metadata.json",
					},
				],
			}),
		],
		devServer: {
			port: 8000,
			setupMiddlewares(middlewares) {
				const rewrites = new Map([
					["/oauth-client-metadata.json", "oauth-client-metadata.dev.json"],
				]);

				middlewares.unshift({
					name: "dev-rewrite-paths",
					middleware(req, res, next) {
						const { pathname } = new URL(req.url, "http://localhost");
						const target = rewrites.get(pathname);
						if (!target) return next();

						res.setHeader("Content-Type", "application/json;charset=utf8");
						fs.createReadStream(path.resolve(__dirname, target)).pipe(res)
					},
				});

				return middlewares;
			},
		},
	};
};
