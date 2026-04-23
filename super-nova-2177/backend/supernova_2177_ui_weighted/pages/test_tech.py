# pages/accessai.py
import streamlit as st

def main():
    st.markdown("### test_tech")
    # Embed the website in an iframe (responsive, full window)
    st.components.v1.html("""
        <iframe src="https://www.accessaitech.com/" style="width:100%; height:100vh; border:none;"></iframe>
    """, height=800)  # Adjusted height for better desktop/mobile fit

if __name__ == "__main__":
    main()
