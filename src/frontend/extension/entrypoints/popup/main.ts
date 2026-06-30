import { mount } from 'svelte'
import Popup from './Popup.svelte'

const app = mount(Popup, {
	target: document.getElementById('app') as HTMLElement
})

export default app
