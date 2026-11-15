const { onRequest } = require("firebase-functions/v2/https");
const next = require("next");
const path = require("path");

// Use relative path for distDir (Next.js expects this)
const nextjsDistDir = ".next";

// Initialize Next.js server
const nextjsServer = next({
    dev: false,
    dir: __dirname, // Set the app directory to the functions folder
    conf: {
        distDir: nextjsDistDir,
    },
});

const nextjsHandle = nextjsServer.getRequestHandler();

// Prepare Next.js server once at cold start
let isServerPrepared = false;
const prepareServer = async () => {
    if (!isServerPrepared) {
        await nextjsServer.prepare();
        isServerPrepared = true;
        console.log("Next.js server prepared successfully");
    }
};

exports.nextjsFunc = onRequest(
    {
        region: "us-central1",
        memory: "1GiB",
        timeoutSeconds: 60,
        maxInstances: 10,
        minInstances: 0, // Scale to zero when not in use
    },
    async (req, res) => {
        try {
            await prepareServer();
            return nextjsHandle(req, res);
        } catch (error) {
            console.error("Error handling request:", error);
            res.status(500).send("Internal Server Error");
        }
    }
);
