import type { Program } from "ollieos/types";

const BUNDLE_PATH = "/usr/bin/doom/bundle.jsdos";

export default {
    name: "doom",
    description: "DOOM.",
    usage_suffix: "",
    arg_descriptions: {},
    compat: "2.0.0",
    main: async (data) => {
        const { kernel, term, process } = data;

        const wm = kernel.has_window_manager();
        if (!wm) {
            term.writeln("Window manager not found.");
            return 1;
        }

        // load js-dos from cdn
        // first check if it's already loaded
        if (!(window as any).emulators) {
            await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "https://v8.js-dos.com/latest/emulators/emulators.js";
                script.onload = () => resolve();
                script.onerror = () => reject(new Error("Failed to load js-dos library."));
                document.head.appendChild(script);
            });

            (window as any).emulators.pathPrefix = "https://v8.js-dos.com/latest/emulators/";
        }

        // load the bundle as a blob url from the fs
        const fs = kernel.get_fs();
        const bundle_data = await fs.read_file(BUNDLE_PATH, true) as Uint8Array;
        const bundle_blob = new Blob([bundle_data.slice()], { type: "application/zip" });
        const bundle_url = URL.createObjectURL(bundle_blob);

        const wind = process.create_window();
        wind.title = "DOOM";

        // determine if width or height is the limiting factor
        const aspect_ratio = 3 / 2;
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

        const emulators = (window as any).emulators;
        const bundle = await emulators.bundle(bundle_url);

        const ci = await emulators.dosboxWorker(bundle);

        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        dos_div.appendChild(canvas);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            term.writeln("Failed to get canvas context.");
            return 1;
        }

        const rgba = new Uint8ClampedArray(320 * 200 * 4);
        ci.events().onFrame((rgb) => {
            for (let next = 0; next < 320 * 200; ++next) {
                rgba[next * 4 + 0] = rgb[next * 3 + 0];
                rgba[next * 4 + 1] = rgb[next * 3 + 1];
                rgba[next * 4 + 2] = rgb[next * 3 + 2];
                rgba[next * 4 + 3] = 255;
            }

            ctx?.putImageData(new ImageData(rgba, 320, 200), 0, 0);
        });

        await ci.shell("doom");

        wind.dom.appendChild(dos_div);
        wind.show();

        wind.add_event_listener("hide", async () => {
            ci.pause();
        });

        wind.add_event_listener("show", async () => {
            ci.resume();
        });

        wind.add_event_listener("close", async () => {
            ci.exit();

            URL.revokeObjectURL(bundle_url);
            process.kill(0);
        });

        process.detach();
        return 0;
    }
} as Program;

// TODO: better restoration of keyboard control on minimise and unfocus some hack like this? https://gemini.google.com/app/3bdc1732e3b45452
// perhaps use term._core._keyUp instead to send the event directly to xterm?
