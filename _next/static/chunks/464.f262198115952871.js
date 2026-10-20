"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[464],{3464:(e,i,t)=>{t.r(i),t.d(i,{OutputPass:()=>n});var r=t(5339),a=t(3617);let s={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class n extends a.o{constructor(){super(),this.isOutputPass=!0,this.uniforms=r.LlO.clone(s.uniforms),this.material=new r.D$Q({name:s.name,uniforms:this.uniforms,vertexShader:s.vertexShader,fragmentShader:s.fragmentShader}),this._fsQuad=new a.F(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,i,t){this.uniforms.tDiffuse.value=t.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},r.ppV.getTransfer(this._outputColorSpace)===r.KLL&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===r.kyO?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===r.Mjd?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===r.nNL?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===r.FV?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===r.LAk?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===r.aJ8?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===r.g7M&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),!0===this.renderToScreen?e.setRenderTarget(null):(e.setRenderTarget(i),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil)),this._fsQuad.render(e)}dispose(){this.material.dispose(),this._fsQuad.dispose()}}},3617:(e,i,t)=>{t.d(i,{F:()=>l,o:()=>a});var r=t(5339);class a{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}let s=new r.qUd(-1,1,1,-1,0,1);class n extends r.LoY{constructor(){super(),this.setAttribute("position",new r.qtW([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new r.qtW([0,2,0,0,2,0],2))}}let o=new n;class l{constructor(e){this._mesh=new r.eaF(o,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,s)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}}}]);