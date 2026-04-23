function LiquidGlass({children, className}) {
    return (
        <>
            <div className={`wrapper ${className}`}>
        <div className="m-auto dock">
          <div className="effect"></div>
          <div className="tint"></div>
          <div className="shine"></div>
          <div className="text">
            <div className="dock">
              {children}
            </div>
          </div>
        </div>
      </div>

      <svg style={{ display: "none" }}>
        <filter
          id="glass-distortion"
          x="0%"
          y="0%"
          width="100%"
          height="100%"
          filterUnits="objectBoundingBox"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.000001 0.001"
            numOctaves="3"
            seed="3"
            result="turbulence"
          />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
            <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
            <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
          </feComponentTransfer>
          <feGaussianBlur in="turbulence" stdDeviation="50" result="softMap" />
          <feSpecularLighting
            in="softMap"
            surfaceScale="5"
            specularConstant="1"
            specularExponent="100"
            lightingColor="white"
            result="specLight"
          >
            <fePointLight x="-200" y="-200" z="300" />
          </feSpecularLighting>
          <feComposite
            in="specLight"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="1"
            k4="0"
            result="litImage"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="softMap"
            scale="100"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>
        </>
    )
}

export default LiquidGlass
