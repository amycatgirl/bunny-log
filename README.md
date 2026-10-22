# bunny log 🐇📜

## what is it
a micro blogging site that uses atproto to store shit

## can i use it
yes, but

## but what
but not from my website

you will have to fork the project, edit `src/app.js`, and host it by yourself

## why
bc the app is intended for my use only

you can use it, sure, whatever, literally edit the `src/app.js` to allow your account's DID

but

don't go complaining to me about your logs not appearing on my site

## ok but like why did you make this
two things

i was bored

and i am sick of mainstream microblogging sites

hence

bunny log ✨

## alright, ok 
are we on the same page?

ok

lexicons (if you want to make your own bunny log) are published and are also available on `./lexicons/space/bunniesin/log/entry.json`


## how does it look tho

like [this](https://log.bunniesin.space)

## developing

install the dependencies:
```bash
pnpm install
```

run the development server:
```bash
pnpm dev
```

the development server handles the OAuth metadata rewrite automatically
(`/oauth-client-metadata.json` is served from `oauth-client-metadata.dev.json`).

build the production site into `dist`:
```bash
pnpm build
```

we love basic ass web apps 💖🐇

## licence

mit, do whatever the fuck you want

but please credit me

or don't

k thx
