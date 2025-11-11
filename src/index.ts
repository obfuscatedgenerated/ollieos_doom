import type { Program } from "ollieos/types";

export default {
    name: "doom",
    description: "DOOM.",
    usage_suffix: "",
    arg_descriptions: {},
    main: async (data) => {
        const { term } = data;

        const wm = term.get_window_manager();
        if (!wm) {
            term.writeln("Window manager not found.");
            return 1;
        }

        // load js-dos from cdn
        // first check if it's already loaded
        if (!(window as any).Dos) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "https://v8.js-dos.com/latest/js-dos.js";
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Failed to load js-dos library."));
                document.head.appendChild(script);
            });
        }

        const wind = new wm.Window();
        wind.title = "DOOM";

        // determine if width or height is the limiting factor
        const aspect_ratio = 320 / 200;
        const width_limited = (window.innerWidth / window.innerHeight) < aspect_ratio;

        // generate width and height based on limiting factor. get to 95% of the limiting factor but maintain 4:3 aspect ratio
        // do it in terms of viewport units, ensuring to use the same unit for both width and height
        const unit = width_limited ? "vw" : "vh";
        const win_size = 95;

        const width = width_limited ? win_size : (win_size * aspect_ratio);
        const height = width_limited ? (win_size / aspect_ratio) : win_size

        wind.width = `${width}${unit}`;
        wind.height = `${height}${unit}`;

        // use window.inner sizes to center the window
        wind.x = (window.innerWidth - (width_limited ? (win_size / 100 * window.innerWidth) : (win_size * aspect_ratio / 100 * window.innerHeight))) / 2;
        wind.y = (window.innerHeight - (width_limited ? (win_size / aspect_ratio / 100 * window.innerWidth) : (win_size / 100 * window.innerHeight))) / 2;

        // load js-dos style only in the shadow dom
        await new Promise<void>((resolve, reject) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://v8.js-dos.com/latest/js-dos.css";
            link.onload = () => resolve();
            link.onerror = () => reject(new Error("Failed to load js-dos stylesheet."));
            wind.dom.appendChild(link);
        });

        const dos_div = document.createElement("div");
        dos_div.style.width = "100%";
        dos_div.style.height = "100%";

        const dos = (window as any).Dos(dos_div, {
            // TODO: host ourself
            url: "https://raw.githubusercontent.com/linuxfandudeguy/doomonline/refs/heads/master/bundle.jsdos",
            noCloud: true,
            kiosk: true,
            autoStart: true,
        });

        wind.dom.appendChild(dos_div);
        wind.show();

        wind.add_event_listener("hide", async () => {
            dos.setPaused(true);
        });

        wind.add_event_listener("close", async () => {
            dos.stop();
        });

        return 0;
    }
} as Program;

// TODO: better restoration of keyboard control on minimise and unfocus
