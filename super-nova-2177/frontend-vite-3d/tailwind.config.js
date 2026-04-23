/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'nova-purple': '#a855f7', // Example custom color
            },
        },
    },
    plugins: [],
}
