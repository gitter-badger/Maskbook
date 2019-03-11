import { queryPersonCryptoKey } from '../key-management/db'

// tslint:disable: await-promise

async function toECDSA(key: CryptoKey) {
    const exported = await crypto.subtle.exportKey('jwk', key)
    return crypto.subtle.importKey('jwk', exported, { name: 'ecdsa', namedCurve: 'K-256' }, true, ['sign', 'verify'])
}
async function toECDH(key: CryptoKey) {
    const exported = await crypto.subtle.exportKey('jwk', key)
    return crypto.subtle.importKey('jwk', exported, { name: 'ECDH', namedCurve: 'K-256' }, true, ['deriveKey'])
}
function addUint8Array(a: ArrayBuffer, b: ArrayBuffer) {
    const x = new Uint8Array(a)
    const y = new Uint8Array(b)
    const c = new Uint8Array(x.length + y.length)
    c.set(x)
    c.set(y, x.length)
    return c
}
export function encode(str: string) {
    return new TextEncoder().encode(str)
}
export function decode(str: ArrayBuffer) {
    return new TextDecoder().decode(str)
}
export function stringToArrayBuffer(str: string): ArrayBuffer {
    const decodedString = atob(str)
    const uintArr = []
    for (const i of decodedString) uintArr.push(i.charCodeAt(0))
    return new Uint8Array(uintArr).buffer
}
export function ArrayBufferToString(buffer: ArrayBuffer) {
    const x = [...new Uint8Array(buffer)]
    const encodedString = String.fromCharCode.apply(null, x)
    return btoa(encodedString)
}
export async function generateAESKey(
    privateKey: CryptoKey,
    othersPublicKey: CryptoKey,
    /** If salt is not provided, we will generate one. And you should send it to your friend. */
    salt = crypto.getRandomValues(new Uint8Array(64)),
) {
    const op = othersPublicKey.usages.find(x => x === 'deriveKey') ? othersPublicKey : await toECDH(othersPublicKey)
    const pr = privateKey.usages.find(x => x === 'deriveKey') ? privateKey : await toECDH(privateKey)
    const derivedKey = await crypto.subtle.deriveKey(
        { name: 'ECDH', public: op },
        pr,
        { name: 'AES-CBC', length: 256 },
        true,
        ['encrypt', 'decrypt'],
    )
    // TODO: Need a name.
    const UntitledUint8Array = addUint8Array(new Uint8Array(await crypto.subtle.exportKey('raw', derivedKey)), salt)
    const password = await crypto.subtle.digest(
        'SHA-256',
        addUint8Array(addUint8Array(UntitledUint8Array, salt), stringToArrayBuffer('KEY')),
    )
    const iv_pre = new Uint8Array(
        await crypto.subtle.digest(
            'SHA-256',
            addUint8Array(addUint8Array(UntitledUint8Array, salt), stringToArrayBuffer('IV')),
        ),
    )
    const iv = new Uint8Array(16)
    for (let i = 0; i <= 16; i += 1) {
        // tslint:disable-next-line: no-bitwise
        iv[i] = iv_pre[i] ^ iv_pre[16 + i]
    }
    const AESKey = await crypto.subtle.importKey('raw', password, { name: 'AES-CBC', length: 32 }, true, [
        'encrypt',
        'decrypt',
    ])
    return { key: AESKey, salt: salt, iv }
}
export async function encryptText(content: string, privateKeyECDH: CryptoKey, othersPublicKeyECDH: CryptoKey) {
    const contentArrayBuffer = encode(content)
    const sig = await sign(content, privateKeyECDH)
    const { iv, key: AESKey, salt } = await generateAESKey(privateKeyECDH, othersPublicKeyECDH)
    const encryptedText = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: iv.buffer }, AESKey, contentArrayBuffer)
    return {
        signature: ArrayBufferToString(sig),
        salt: ArrayBufferToString(salt),
        encryptedText: ArrayBufferToString(encryptedText),
    }
}
export async function decryptText(
    _encryptedText: string,
    signature: string,
    _salt: string,
    privateKey: CryptoKey,
    othersPublicKey: CryptoKey,
    myPost?: boolean,
) {
    const encryptText = stringToArrayBuffer(_encryptedText)
    const salt = stringToArrayBuffer(_salt)

    const { iv, key: AESKey } = await generateAESKey(privateKey, othersPublicKey, new Uint8Array(salt))
    const decryptText = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: iv.buffer }, AESKey, encryptText)
    const orig = decode(decryptText)

    let verifyKey = othersPublicKey
    if (myPost) verifyKey = (await queryPersonCryptoKey('$self'))!.key.publicKey
    const signatureVerifyResult = await verify(orig, signature, verifyKey)
    return { signatureVerifyResult, content: orig }
}

export async function sign(msg: string | ArrayBuffer, privateKey: CryptoKey) {
    const ecdsakey = privateKey.usages.indexOf('sign') !== -1 ? privateKey : await toECDSA(privateKey)
    // tslint:disable-next-line: no-parameter-reassignment
    if (typeof msg === 'string') msg = encode(msg)
    return crypto.subtle.sign({ name: 'ECDSA', hash: { name: 'SHA-256' } }, ecdsakey, msg)
}

export async function verify(msg: string | ArrayBuffer, signature: string | ArrayBuffer, publicKey: CryptoKey) {
    const ecdsakey = publicKey.usages.indexOf('verify') !== -1 ? publicKey : await toECDSA(publicKey)
    // tslint:disable-next-line: no-parameter-reassignment
    if (typeof msg === 'string') msg = encode(msg)
    // tslint:disable-next-line: no-parameter-reassignment
    if (typeof signature === 'string') signature = stringToArrayBuffer(signature)
    return crypto.subtle.verify({ name: 'ECDSA', hash: { name: 'SHA-256' } }, ecdsakey, signature, msg)
}

Object.assign(window, {
    generateAESKey,
    encryptText,
    decryptText,
    verify,
    sign,
})