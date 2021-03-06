import React from 'react'
import ReactDOM from 'react-dom'
import { DomProxy, LiveSelector, MutationObserverWatcher } from '@holoflows/kit'
//#region Welcome
enum WelcomeState {
    // Step 0
    Start,
    // Step 1
    WaitLogin,
    Intro,
    BackupKey,
    ProvePost,
    Restore1,
    // End
}
const body = DomProxy()
body.realCurrent = document.body
ReactDOM.render(<WelcomePortal />, body.after)

import Welcome0 from '../../../components/Welcomes/0'
import Welcome1a1 from '../../../components/Welcomes/1a1'
import Welcome1a2 from '../../../components/Welcomes/1a2'
import Welcome1a3 from '../../../components/Welcomes/1a3'
import Welcome1a4 from '../../../components/Welcomes/1a4'
import Welcome1b1 from '../../../components/Welcomes/1b1'
import Dialog from '@material-ui/core/Dialog'
import { MuiThemeProvider } from '@material-ui/core'
import { MaskbookLightTheme } from '../../../utils/theme'
import { sleep } from '../../../utils/utils'
import { useAsync } from '../../../utils/AsyncComponent'
import { BackgroundService, CryptoService, PeopleService } from '../rpc'
import { useEsc } from '../../../components/Welcomes/useEsc'
import { myUsername } from './LiveSelectors'
const isLogined = () => !document.querySelector('.login_form_label_field')
const loginWatcher = async () => {
    while (!isLogined()) await sleep(500)
}
function restoreFromFile(file: File) {
    const fr = new FileReader()
    fr.readAsText(file)
    fr.addEventListener('loadend', async f => {
        const json = JSON.parse(fr.result as string)
        PeopleService.storeKey(json)
    })
}
function Welcome(props: {
    current: WelcomeState
    setCurrent(x: WelcomeState): void
    waitLogin(): void
    finish(): void
}) {
    const { current, setCurrent, waitLogin } = props
    const [provePost, setProvePost] = React.useState('')
    useAsync(() => CryptoService.getMyProveBio(), [provePost.length !== 0]).then(setProvePost)
    switch (current) {
        case WelcomeState.Start:
            return (
                <Welcome0
                    create={() => setCurrent(isLogined() ? WelcomeState.Intro : WelcomeState.WaitLogin)}
                    restore={() => setCurrent(WelcomeState.Restore1)}
                    close={() => props.finish()}
                />
            )
        case WelcomeState.WaitLogin:
            return <Welcome1a1 next={() => (waitLogin(), setCurrent(WelcomeState.Intro))} />
        case WelcomeState.Intro:
            return (
                <Welcome1a2
                    next={() => {
                        setCurrent(WelcomeState.BackupKey)
                        BackgroundService.backupMyKeyPair()
                    }}
                />
            )
        case WelcomeState.BackupKey:
            return <Welcome1a3 next={() => setCurrent(WelcomeState.ProvePost)} />
        case WelcomeState.ProvePost:
            return (
                <Welcome1a4
                    provePost={provePost}
                    copyToClipboard={(text, goToProfile) => {
                        ;(navigator as any).clipboard.writeText(text)
                        if (goToProfile) {
                            const a = myUsername.evaluateOnce()[0]
                            if (a) location.href = a.href
                        }
                        props.finish()
                    }}
                />
            )
        case WelcomeState.Restore1:
            return (
                <Welcome1b1
                    back={() => setCurrent(WelcomeState.Start)}
                    restore={url => {
                        props.finish()
                        restoreFromFile(url)
                    }}
                />
            )
    }
}
function getStorage() {
    return new Promise<any>((resolve, reject) => {
        chrome.storage.local.get(resolve)
    })
}
function WelcomePortal() {
    const [open, setOpen] = React.useState(true)
    const [current, setCurrent] = React.useState(WelcomeState.Start)
    const [init, setInit] = React.useState(true)

    function onFinish() {
        setOpen(false)
        chrome.storage.local.set({ init: true })
    }
    function waitLogin() {
        setOpen(false)
        loginWatcher().then(() => setOpen(true))
    }
    useAsync(() => getStorage(), [0]).then(data => setInit(data.init))
    useEsc(onFinish)
    // Only render in main page
    if (location.pathname !== '/') return null
    if (init) return null
    return (
        <MuiThemeProvider theme={MaskbookLightTheme}>
            <Dialog open={open}>
                <Welcome current={current} setCurrent={setCurrent} waitLogin={waitLogin} finish={onFinish} />
            </Dialog>
        </MuiThemeProvider>
    )
}
//#endregion
//#region Welcome invoke manually
{
    const to = new MutationObserverWatcher(
        new LiveSelector().querySelectorAll<HTMLAnchorElement>('#createNav a').nth(3),
    ).startWatch()
    ReactDOM.render(
        <>
            {' · '}
            <a
                href="#"
                onClick={() => {
                    chrome.storage.local.clear()
                    location.reload()
                }}>
                Maskbook Setup
            </a>
        </>,
        to.firstVirtualNode.after,
    )
}
//#endregion
