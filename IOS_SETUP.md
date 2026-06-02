# Progress Todo iOS Setup

The iOS project is already generated at `ios/App/App.xcodeproj`.

The app shell loads the deployed web app:

`https://vibecoding-six-theta.vercel.app`

## Local Machine Requirement

Install full Xcode from the App Store, then select it:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
npm run ios:doctor
```

## Run

```bash
npm run ios:open
```

In Xcode:

- Open the `App` target.
- Set `Signing & Capabilities` to your Apple Development Team.
- Choose an iPhone simulator or device.
- Press Run.

## Notes

- The Bailian API token is kept on the deployed web server, not inside the iOS app.
- The iOS bundle id is `com.vibecoding.progresstodo`.
- The app uses HTTPS only through the deployed Vercel URL.
