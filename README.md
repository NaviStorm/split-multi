# Super Split View

**Super Split View** is a Firefox extension that enhances your productivity by allowing you to display multiple web pages side-by-side. You can combine selected tabs into a single, unified split view, either within a new tab or as tiled windows.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

## Features

-   **Two Display Modes:**
    -   **Window Tiling Mode (Recommended):** Creates new, perfectly tiled browser windows. This mode preserves all browser functionalities like the address bar, history, and ad blockers.
    -   **Single Tab Mode:** Displays all pages within a single tab using iframes for a sleek, integrated look. Note: Some sites with strict security policies may not work in this mode.
-   **Flexible Layouts:** Create split views with 2, 3, or 4 tabs.
-   **Persistent Views:** Name your split views (e.g., "Project Research", "Social Media") to easily identify them.
-   **Dynamic Management:** Add new tabs to existing split views on the fly via the context menu.
-   **Security Fallback:** Automatically switches to Window Tiling Mode for websites that block iframe embedding, ensuring you can always view your content.
-   **Customizable:** Configure your preferred default mode and manage a list of sites that should always open in windowed mode.

## How to Use

1.  **Create a Split View:**
    -   Select 2 to 4 tabs by holding `Ctrl` (Windows/Linux) or `Cmd` (Mac) and clicking them.
    -   Click the Super Split View icon in your toolbar.
    -   Your split view will open in your configured default mode!

2.  **Add a Tab to an Existing View:**
    -   Make sure you have at least one split view open and named.
    -   Right-click on the tab you want to add.
    -   Navigate to "Add to an existing Split View..." and select the target view by its name.

## Important Security Note (Iframes)

Some websites (especially banks, social media, and login pages) use security headers like `X-Frame-Options` or a strict `Content-Security-Policy` to prevent themselves from being embedded in other pages (like in an iframe).

When you try to create a split view in "Single Tab Mode" with one of these sites, it will fail to load.

**Solution:** Super Split View automatically detects this issue and will open the view in "Window Tiling Mode" instead. You can also proactively add domains to the "Sites to Always Open in Window Mode" list in the extension's options.

## Installation

1.  Download the latest release from the Firefox Add-ons store (link to be added).
2.  Or, load the extension manually in `about:debugging` for development.

## Contributing

Contributions are welcome! If you have ideas for new features or find a bug, please open an issue.

## License

This project is licensed under the MIT License.