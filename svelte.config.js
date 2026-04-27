import adapter from '@sveltejs/adapter-cloudflare'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import { mdsvex } from 'mdsvex'
import rehypeSlug from 'rehype-slug'
import remarkGfm from 'remark-gfm'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	preprocess: [
		vitePreprocess(),
		mdsvex({
			remarkPlugins: [remarkGfm],
			rehypePlugins: [rehypeSlug]
		})
	],
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			config: 'wrangler.svelte.jsonc'
		}),
		files: {
			routes: 'src/web/routes',
			params: 'src/web/params',
			hooks: {
				server: 'src/web/hooks.server'
			},
			appTemplate: 'src/web/app.html'
		},
		alias: {
			$shared: 'src/shared',
			$web: 'src/web/lib',
			$root: '.'
		}
	}
}

export default config
