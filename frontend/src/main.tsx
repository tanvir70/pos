import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import brandLogoUrl from "./assets/logo.png"

// Dynamically sync favicon in the browser tab so it reflects the brand immediately
if (typeof document !== "undefined") {
  const syncFavicon = (url: string) => {
    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null
    if (!link) {
      link = document.createElement("link")
      link.rel = "shortcut icon"
      document.head.appendChild(link)
    }
    link.type = "image/png"
    link.href = url
  }
  syncFavicon(brandLogoUrl)
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
