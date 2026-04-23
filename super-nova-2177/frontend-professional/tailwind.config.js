/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'professional-blue': '#0a66c2',
                'professional-dark-blue': '#004182',
                'professional-gray': '#f3f2ef',
                'professional-dark-gray': '#e9e5df',
                'professional-text-primary': 'rgba(0, 0, 0, 0.9)',
                'professional-text-secondary': 'rgba(0, 0, 0, 0.6)',
            },
            fontFamily: {
                sans: [
                    '-apple-system',
                    'system-ui',
                    'BlinkMacSystemFont',
                    '"Segoe UI"',
                    'Roboto',
                    '"Helvetica Neue"',
                    'Arial',
                    'sans-serif',
                ],
            },
        },
    },
    plugins: [],
}
