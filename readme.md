My first application!
(and it happens to be electron)

A lightweight Youtube Desktop application!
Comes with Sponsorblock and Return YouTube Dislike.

---

A extremely lightweight electron app that renders Youtube when ran and injects Sponsorblock and Return Youtube Dislike web extensions into it  
comes with UBlock Origin filter lists that are fed through the app using adblocker-electron

Slow on initial launch due to extension loading, once the page fully loads it should be lightning fast!

This application is built with longevity in mind, no app updates, ever, yet it will always work. 
(unless the people in credits change their URL's or the filterlist software breaks)

Could theoretically be compiled to any major operating system including Linux and Mac
simply install Node.js on your prefered OS, clone the repo and run `NPM run build` (to build app) or `NPM Start` in project directory (to run app locally without building)

---

# Credits

## Website

[YouTube](https://www.youtube.com/)

## Extensions

[Return Youtube Dislike](https://www.returnyoutubedislike.com/)
[Sponsorblock](https://sponsor.ajay.app/)

## Adblocking

Filterlist Software: [adblocker-electron](https://www.npmjs.com/package/@ghostery/adblocker-electron)

UBlock Origin: [Filters](https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/filters.txt),
               [Privacy](https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/privacy.txt),
			   [Badware](https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/badware.txt),
			   [Quick Fixes](https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/quick-fixes.txt),
			   [Unbreak](https://github.com/uBlockOrigin/uAssets/raw/refs/heads/master/filters/unbreak.txt)

Easylist:      [Easylist](https://easylist.to/easylist/easylist.txt),
               [EasyPrivacy](https://easylist.to/easylist/easyprivacy.txt)

Generic:       [Malicious URL Blocklist](https://malware-filter.gitlab.io/malware-filter/urlhaus-filter-online.txt)

Peter Lowe:    [Ad and tracking server list](https://pgl.yoyo.org/adservers/serverlist.php?hostformat=hosts&showintro=1&mimetype=plaintext)
