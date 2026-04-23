# pages/enter_metaverse.py
import streamlit as st
import streamlit.components.v1 as components

def main():
    # Do NOT call set_page_config here; ui.py already handles it.

    # --- Session state defaults ---
    st.session_state.setdefault("metaverse_launched", False)
    st.session_state.setdefault("settings", {"difficulty": "Normal", "volume": 30})

    # --- Global CSS for this page ---
    st.markdown("""
        <style>
            body { background-color: #000; }
            .stApp { background-color: #000; overflow: hidden; }
            .main > div { padding: 0; }
            .block-container { padding-top: 2rem !important; padding-bottom: 2rem !important; max-width: 100% !important; }
            header, #MainMenu, footer { display: none !important; }
        </style>
    """, unsafe_allow_html=True)

    # --- Stage 1: Lobby ---
    if not st.session_state.metaverse_launched:
        st.markdown("""
            <div style="text-align: center; z-index: 10;">
                <h1 style="
                    font-family: 'Courier New', monospace;
                    background: linear-gradient(45deg, #ff00ff, #00ffff, #ffff00, #ff00ff);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
                    font-size: 3.5em; font-weight: bold; text-shadow: 0 0 30px rgba(255,0,255,0.7);
                    animation: pulse 2.5s infinite;
                ">SUPERNOVA METAVERSE</h1>
                <p style="color: #00ffff; font-size: 1.2em; margin-top: -15px; letter-spacing: 2px;">
                    🎮 K-POP × RETRO GAMING × CYBERPUNK 🎮
                </p>
            </div>
            <style>
                @keyframes pulse { 0%,100% { opacity:1; transform:scale(1);} 50% { opacity:.85; transform:scale(1.02);} }
            </style>
        """, unsafe_allow_html=True)

        st.markdown('<div style="height: 50px;"></div>', unsafe_allow_html=True)

        col1, col2, col3 = st.columns([1.5, 2, 1.5])
        with col2:
            st.markdown("<h3 style='text-align:center; color:#00ffff;'>🎛️ GAME SETUP</h3>", unsafe_allow_html=True)
            difficulty = st.select_slider("🔥 Difficulty", ["Easy", "Normal", "Hard"], value=st.session_state.settings["difficulty"])
            volume = st.slider("🔊 Music Volume", 0, 100, st.session_state.settings["volume"])
            st.session_state.settings.update({"difficulty": difficulty, "volume": volume})

            st.markdown('<div style="height: 20px;"></div>', unsafe_allow_html=True)
            st.markdown('<div style="display:flex; justify-content:center;">', unsafe_allow_html=True)

            if st.button("🚀 ENTER THE METAVERSE 🚀", use_container_width=True):
                st.session_state.metaverse_launched = True
                st.rerun()

            st.markdown('</div>', unsafe_allow_html=True)

        return  # stop here in lobby

    # --- Stage 2: Metaverse (responsive Three.js canvas) ---
    settings = st.session_state.settings
    three_js_code = f"""<!DOCTYPE html><html><head>
      <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        body {{ margin:0; overflow:hidden; background:#000; cursor:crosshair; }}
        #canvas-container {{ width:100vw; height:100vh; position:fixed; top:0; left:0; }}
        #loading-screen, #game-over-screen {{
          position:fixed; top:0; left:0; width:100%; height:100%;
          background:rgba(0,0,0,0.8); display:flex; flex-direction:column; justify-content:center; align-items:center;
          z-index:1000; font-family:'Courier New', monospace; color:#fff;
        }}
        #game-over-screen {{ display:none; }}
        #game-over-title {{ font-size:3em; color:#ff0066; text-shadow:0 0 10px #ff0066; }}
        #final-score {{ font-size:1.5em; margin:20px 0; }}
        #restart-button {{
          padding:10px 20px; border:2px solid #00ffff; color:#00ffff; background:transparent; cursor:pointer;
          font-size:1em; text-transform:uppercase; letter-spacing:2px;
        }}
        .loader {{ width:100px; height:100px; border:4px solid transparent; border-top:4px solid #ff00ff;
                   border-right:4px solid #00ffff; border-radius:50%; animation:spin 1s linear infinite; }}
        @keyframes spin {{ 100% {{ transform:rotate(360deg); }} }}
        #loading-text {{ margin-top:25px; font-size:1.1em; letter-spacing:4px; animation:glow 2s ease-in-out infinite; }}
        @keyframes glow {{ 0%,100% {{ text-shadow:0 0 10px #ff00ff; }} 50% {{ text-shadow:0 0 20px #00ffff; }} }}
        #hud {{ position:fixed; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10; color:#fff;
                font-family:'Courier New', monospace; }}
        #score {{ position:absolute; top:20px; left:20px; font-size:24px; color:#ffff00; }}
        #health-bar {{ position:absolute; top:20px; left:50%; transform:translateX(-50%); width:300px; height:20px;
                       border:2px solid #ff00ff; background:rgba(0,0,0,0.5); }}
        #health-fill {{ height:100%; background:#ff0066; transition:width .3s ease; }}
        #mobile-controls {{ display:none; }}
        #joystick-zone {{ position:fixed; left:80px; bottom:80px; width:120px; height:120px; pointer-events:auto; }}
        #mobile-actions {{ position:fixed; right:20px; bottom:50px; display:flex; flex-direction:column; gap:20px; pointer-events:auto; }}
        .mobile-button {{ width:60px; height:60px; border:2px solid #00ffff; border-radius:50%; background:rgba(0,255,255,.2);}}
      </style>
    </head>
    <body>
      <div id="loading-screen"><div class="loader"></div><div id="loading-text">INITIALIZING</div></div>
      <div id="game-over-screen"><div id="game-over-title">SYSTEM FAILURE</div><div id="final-score">SCORE: 0</div><button id="restart-button">REINITIALIZE</button></div>
      <div id="canvas-container"></div>
      <div id="hud"><div id="score">SCORE: 0</div><div id="health-bar"><div id="health-fill"></div></div></div>
      <div id="mobile-controls"><div id="joystick-zone"></div><div id="mobile-actions"><div id="mobile-dash" class="mobile-button"></div><div id="mobile-jump" class="mobile-button"></div></div></div>

      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/howler/2.2.3/howler.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/nipplejs@0.10.1/dist/nipplejs.min.js"></script>
      <script type="module">
        import {{ PointerLockControls }} from 'https://cdn.skypack.dev/three@0.128.0/examples/jsm/controls/PointerLockControls.js';

        let scene, camera, renderer, clock, p_controls, audioManager, gameManager, player;
        const entities = []; const keyMap = {{}};
        const CONFIG = {{ difficulty: '{settings["difficulty"]}', volume: {settings["volume"]} / 100 }};

        class AudioManager {{
          constructor(){{
            this.sounds = new Howl({{
              // tiny silent loop placeholder, replace with your own sprites later
              src: ['data:audio/mp3;base64,SUQzBAAAAAA='],
              sprite: {{ music:[0,60000,true], jump:[1000,200], dash:[2000,500], collect:[3000,300], damage:[4000,400], gameOver:[5000,1000] }},
              volume: CONFIG.volume
            }});
          }}
          play(n){{ try{{ this.sounds.play(n); }}catch(_){{}} }}
        }}

        class Player {{
          constructor(){{
            this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,2,16),
                                       new THREE.MeshStandardMaterial({{color:0xffffff, roughness:.2, metalness:.8}}));
            this.mesh.position.y = 10;
            this.velocity = new THREE.Vector3(); this.onGround = false; this.dashCooldown = 0; this.health = 100;
            this.mesh.add(new THREE.PointLight(0x00ffff, 2, 20));
            scene.add(this.mesh);
          }}
          update(delta, dir){{ if(this.health<=0) return;
            this.dashCooldown = Math.max(0, this.dashCooldown - delta);
            this.velocity.x += dir.x * 200 * delta; this.velocity.z += dir.z * 200 * delta; this.velocity.y -= 25 * delta;
            this.mesh.position.add(this.velocity.clone().multiplyScalar(delta));
            if (this.mesh.position.y < 1) {{ this.mesh.position.y = 1; this.velocity.y = 0; this.onGround = true; }} else {{ this.onGround = false; }}
            this.velocity.x *= 0.9; this.velocity.z *= 0.9;
          }}
          jump(){{ if(this.onGround){{ this.velocity.y = 10; audioManager.play('jump'); }} }}
          dash(){{ if(this.dashCooldown<=0){{ const d = p_controls.getDirection(new THREE.Vector3()); if(d.lengthSq()===0) d.z = -1;
                     this.velocity.add(d.multiplyScalar(20)); this.dashCooldown = 2; audioManager.play('dash'); }} }}
          takeDamage(a){{ this.health = Math.max(0, this.health - a);
            document.getElementById('health-fill').style.width = this.health + '%';
            audioManager.play('damage'); if(this.health<=0) gameManager.gameOver();
          }}
        }}

        class Enemy {{
          constructor(){{
            this.mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2,0),
              new THREE.MeshStandardMaterial({{color:0xff0066,emissive:0xff0066,roughness:.5}}));
            this.mesh.position.set((Math.random()-0.5)*100, 1.2, (Math.random()-0.5)*100);
            scene.add(this.mesh); entities.push(this);
          }}
          update(delta, ppos){{ const v = ppos.clone().sub(this.mesh.position).normalize();
            this.mesh.position.add(v.multiplyScalar(2.5*delta));
            if(this.mesh.position.distanceTo(ppos) < 1.5) player.takeDamage(15*delta);
          }}
        }}

        class Collectible {{
          constructor(){{
            this.mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.7),
              new THREE.MeshStandardMaterial({{color:0xffff00,emissive:0xffff00,emissiveIntensity:.8}}));
            this.respawn(); scene.add(this.mesh); entities.push(this);
          }}
          update(delta, ppos){{ this.mesh.rotation.y += delta;
            if(this.mesh.position.distanceTo(ppos) < 2){{ gameManager.addScore(100); this.respawn(); audioManager.play('collect'); }}
          }}
          respawn(){{ this.mesh.position.set((Math.random()-0.5)*120, 1.5, (Math.random()-0.5)*120); }}
        }}

        class GameManager {{
          constructor(){{ this.score = 0; this.isGameOver = false; }}
          addScore(n){{ this.score += n; document.getElementById('score').innerText = `SCORE: ${{this.score}}`; }}
          gameOver(){{ this.isGameOver = true; p_controls.unlock(); audioManager.play('gameOver');
            document.getElementById('final-score').innerText = `FINAL SCORE: ${{this.score}}`;
            document.getElementById('game-over-screen').style.display = 'flex';
          }}
          restart(){{ this.score = 0; this.isGameOver = false; player.health = 100;
            player.mesh.position.set(0,10,0); player.velocity.set(0,0,0);
            document.getElementById('health-fill').style.width = '100%';
            this.addScore(0); document.getElementById('game-over-screen').style.display = 'none'; p_controls.lock();
          }}
        }}

        function init(){{
          audioManager = new AudioManager(); gameManager = new GameManager();
          scene = new THREE.Scene();
          camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
          renderer = new THREE.WebGLRenderer({{ antialias:true }}); renderer.setSize(window.innerWidth, window.innerHeight);
          document.getElementById('canvas-container').appendChild(renderer.domElement);
          clock = new THREE.Clock();

          scene.add(new THREE.GridHelper(200, 50, 0x00ffff, 0x888888));
          scene.add(new THREE.AmbientLight(0x400080, 1.2));

          player = new Player();
          const enemyCount = CONFIG.difficulty==='Easy' ? 3 : (CONFIG.difficulty==='Normal' ? 6 : 10);
          for(let i=0;i<enemyCount;i++) new Enemy();
          for(let i=0;i<15;i++) new Collectible();

          p_controls = new PointerLockControls(camera, renderer.domElement);
          const isMobile = 'ontouchstart' in window;
          if(isMobile){{
            document.getElementById('mobile-controls').style.display='block';
            const joystick = nipplejs.create({{ zone: document.getElementById('joystick-zone'), color:'magenta' }});
            joystick.on('move', (evt, data)=>{{ keyMap.joystickAngle=data.angle.radian; keyMap.joystickForce=data.force/10; }});
            joystick.on('end', ()=>{{ keyMap.joystickForce=0; }});
            document.getElementById('mobile-jump').addEventListener('touchstart', ()=> keyMap['Space']=true);
            document.getElementById('mobile-dash').addEventListener('touchstart', ()=> keyMap['ShiftLeft']=true);
            document.getElementById('mobile-dash').addEventListener('touchend', ()=> keyMap['ShiftLeft']=false);
          }} else {{
            renderer.domElement.addEventListener('click', ()=> p_controls.lock());
          }}

          document.addEventListener('keydown', e=> keyMap[e.code]=true);
          document.addEventListener('keyup', e=> keyMap[e.code]=false);
          document.getElementById('restart-button').onclick = ()=> gameManager.restart();
          window.addEventListener('resize', ()=>{{ camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }});

          const loading = document.getElementById('loading-screen');
          loading.style.opacity = '0';
          setTimeout(()=>{{ loading.style.display='none'; audioManager.play('music'); if(!isMobile) p_controls.lock(); animate(); }}, 1200);
        }}

        function animate(){{
          if(gameManager.isGameOver) return;
          requestAnimationFrame(animate);
          const delta = Math.min(clock.getDelta(), 0.1);
          const dir = new THREE.Vector3();
          const speed = 10 * delta;

          if(p_controls.isLocked){{
            const f = keyMap['KeyW'] ? 1 : (keyMap['KeyS'] ? -1 : 0);
            const r = keyMap['KeyD'] ? 1 : (keyMap['KeyA'] ? -1 : 0);
            p_controls.moveForward(f * speed);
            p_controls.moveRight(r * speed);
            dir.set(r, 0, -f).normalize();
          }} else if (keyMap.joystickForce > 0){{
            const angle = keyMap.joystickAngle, force = keyMap.joystickForce;
            camera.getWorldDirection(dir);
            const rightVec = new THREE.Vector3().crossVectors(camera.up, dir).normalize();
            const forwardVec = new THREE.Vector3().crossVectors(rightVec, camera.up).normalize();
            const moveX = Math.cos(angle) * force * speed;
            const moveZ = Math.sin(angle) * force * speed * -1;
            player.velocity.x += dir.x * moveZ + rightVec.x * moveX;
            player.velocity.z += dir.z * moveZ + rightVec.z * moveX;
          }}

          player.update(delta, dir);
          if (keyMap['Space']) player.jump();
          if (keyMap['ShiftLeft']) player.dash();
          if ('ontouchstart' in window) keyMap['Space'] = false;

          entities.forEach(e => e.update(delta, player.mesh.position));

          if(!p_controls.isLocked){{
            camera.position.lerp(player.mesh.position.clone().add(new THREE.Vector3(0,5,10)), 0.1);
            camera.lookAt(player.mesh.position);
          }}

          renderer.render(scene, camera);
        }}

        init();
      </script>
    </body></html>"""
    components.html(three_js_code, height=800, scrolling=False)

if __name__ == "__main__":
    main()
