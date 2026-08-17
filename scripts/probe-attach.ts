const portFile = Bun.file(
	`${process.env.LOCALAPPDATA}/Google/Chrome/User Data/DevToolsActivePort`,
);
const [port, path] = (await portFile.text()).trim().split(/\r?\n/);
const wsUrl = `ws://127.0.0.1:${port}${path}`;
const view = new Bun.WebView({
	backend: { type: "chrome", url: wsUrl },
	width: 1280,
	height: 720,
});

await view.navigate("https://www.linkedin.com/feed/");
await Bun.sleep(2500);
const href = await view.evaluate("window.location.href");
const title = await view.evaluate("document.title");
const body = await view.evaluate(
	"((document.querySelector('main')||document.body)?.innerText||'').slice(0,300)",
);
await view.cdp("Network.enable");
const cookies = (
	(await view.cdp("Network.getAllCookies")) as {
		cookies: Array<{ name: string; domain: string; value: string }>;
	}
).cookies;
const liAt = cookies.find((c) => c.name === "li_at");
const jsession = cookies.find((c) => c.name === "JSESSIONID");
console.log(
	JSON.stringify(
		{
			href,
			title,
			hasLiAt: Boolean(liAt),
			hasJsession: Boolean(jsession),
			bodyPreview: body,
		},
		null,
		2,
	),
);
view.close();
