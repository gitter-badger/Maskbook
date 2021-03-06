import React from 'react'
import AsyncComponent from '../../utils/AsyncComponent'
import { AdditionalContent } from './AdditionalPostContent'
import { FullWidth } from '../../utils/Flex'
import { CryptoService } from '../../extension/content-script/rpc'

interface Props {
    postBy: string
    whoAmI: string
    encryptedText: string
}
export function DecryptPost({ postBy, whoAmI, encryptedText }: Props) {
    const [_, a] = encryptedText.split('🎼')
    const [b, _2] = a.split(':||')
    return (
        <AsyncComponent
            promise={async (encryptedString: string) => CryptoService.decryptFrom(encryptedString, postBy, whoAmI)}
            values={[b]}
            awaitingComponent={DecryptPostAwaiting}
            completeComponent={DecryptPostSuccess}
            failedComponent={DecryptPostFailed}
        />
    )
}
function DecryptPostSuccess({ data }: { data: { signatureVerifyResult: boolean; content: string } }) {
    return (
        <AdditionalContent
            title={
                <>
                    Maskbook decrypted content: <FullWidth />
                    {data.signatureVerifyResult ? (
                        <span style={{ color: 'green' }}>Signature verified ✔</span>
                    ) : (
                        <span style={{ color: 'red' }}>Signature NOT verified ❌</span>
                    )}
                </>
            }
            children={data.content.split('\n').reduce(
                (prev, curr, i) => {
                    if (i === 0) return [curr]
                    else return [...prev, curr, <br />]
                },
                [] as React.ReactNode[],
            )}
        />
    )
}

const DecryptPostAwaiting = <AdditionalContent title="Maskbook decrypting..." />
function DecryptPostFailed({ error }: { error: Error }) {
    return (
        <AdditionalContent title="Maskbook decryption failed">
            {(e => {
                if (e.match('DOMException')) return 'Maybe this post is not sent to you.'
                return e
            })(error && error.message)}
        </AdditionalContent>
    )
}
export const DecryptPostUI = {
    success: DecryptPostSuccess,
    awaiting: DecryptPostAwaiting,
    failed: DecryptPostFailed,
}
