import { render } from "ink";
import { App } from "./terminal/App.js";

render(<App />, {
    exitOnCtrlC: false
});
