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
			config: 'wrangler.svelte.jsonc',
			platformProxy: {
				configPath: 'wrangler.jsonc',
				envFiles: ['.wrangler/runtime-secrets.env']
			}
		}),
		files: {
			assets: 'src/frontend/web/static',
			routes: 'src/frontend/web/routes',
			params: 'src/frontend/web/params',
			hooks: {
				server: 'src/frontend/web/hooks.server'
			},
			appTemplate: 'src/frontend/web/app.html'
		},
		alias: {
			$shared: 'src/shared',
			$frontend: 'src/frontend/lib',
			$backend: 'src/backend',
			$apiContract: 'src/api-contract',
			$root: '.'
		}
	}
}

export default config
