# How to Run BunnyAI Pro

Since you are developing this extension, here is how to run and test it inside VS Code:

## 1. Build the Project
Ensure the project is built (I've already done this, but good to know):
```bash
npm run build
```

## 2. Launch the Extension
1.  Press **F5** (or go to **Run and Debug** > **Run Extension**).
2.  A new VS Code window (Extension Development Host) will open.

## 3. Test the Features
In the **new** window that opened:
1.  Open the `sample-server.ts` file (I created this in your workspace).
2.  You should see **"Run GET /api/users"** (CodeLens) appear above the code.
3.  Click that button!
4.  The **BunnyAI Request Panel** will open with the method and URL filled in.
5.  Click **Send Request** to see the simulated response.

## 4. Troubleshooting
- If you don't see the CodeLens, try making a small edit to `sample-server.ts` to trigger a re-parse.
- Check the **Debug Console** in the main window for logs.
