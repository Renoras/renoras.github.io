/* ============================================================
   John Moschos — portfolio
   Hero: a morphing PBR sculpture, ray-marched in WebGL.
   One SDF form cycles sphere -> torus -> cube -> octahedron with
   two metaball satellites, lit by a random environment panorama
   each visit. Mouse steers the orbiting camera.
   Plus: nav state, scroll reveals, viewport-aware video playback.
   ============================================================ */

(function () {
    "use strict";

    /* ---------------- footer year ---------------- */
    document.getElementById("year").textContent = new Date().getFullYear();

    /* ---------------- debug: ?raw shows the bare hero canvas ---------------- */
    if (/[?&]raw/.test(location.search)) {
        document.documentElement.classList.add("raw");
    }

    /* ---------------- nav scrolled state ---------------- */
    var nav = document.getElementById("nav");
    addEventListener("scroll", function () {
        nav.classList.toggle("scrolled", scrollY > 12);
    }, { passive: true });

    /* ---------------- project reveal + video playback ---------------- */
    var projects = document.querySelectorAll(".project");
    if ("IntersectionObserver" in window) {
        var reveal = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add("visible");
                    reveal.unobserve(e.target);
                }
            });
        }, { threshold: 0.15 });
        projects.forEach(function (p) { reveal.observe(p); });

        // Videos use preload="none" (~40 MB of clips total) — each one starts
        // downloading and playing only as it approaches the viewport, and
        // pauses again once scrolled past.
        var vids = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                var v = e.target;
                if (e.isIntersecting) { v.play().catch(function () {}); }
                else { v.pause(); }
            });
        }, { rootMargin: "200px 0px", threshold: 0.01 });
        document.querySelectorAll(".project-media video").forEach(function (v) {
            vids.observe(v);
        });
    } else {
        projects.forEach(function (p) { p.classList.add("visible"); });
    }

    /* ============================================================
       WebGL hero.
       Cost profile: single-object march (<= 64 cheap SDF steps),
       4-tap normal, no shadows, no volumetrics — a fraction of a
       modern iGPU. Renders at reduced resolution with an adaptive
       scaler, pauses off screen and on hidden tabs, and honors
       prefers-reduced-motion with a single frame.
       ============================================================ */

    var canvas = document.getElementById("gl");
    var gl = canvas.getContext("webgl", { antialias: false, alpha: false })
          || canvas.getContext("experimental-webgl");
    if (!gl) { return; } // CSS gradient fallback remains

    // Explicit-LOD sampling lets the metal pick its reflection blur by
    // roughness, and gives the ultra-blurred backdrop. Near-universal
    // WebGL1 extension; without it everything still renders, just sharper.
    var hasLod = !!gl.getExtension("EXT_shader_texture_lod");

    var VERT =
        "attribute vec2 aPos;" +
        "void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }";

    var FRAG = [
        hasLod ? "#extension GL_EXT_shader_texture_lod : enable" : "",
        "precision highp float;",
        "uniform vec2 uRes;",
        "uniform float uTime;",
        "uniform vec2 uMouse;",
        "uniform float uSeed;",     // randomizes tumble + start angle per visit
        "uniform sampler2D uEnvTex;",  // current environment
        "uniform sampler2D uEnvTexB;", // next environment, crossfaded in
        "uniform float uEnvFade;",     // 0 = current, 1 = next
        "uniform float uEnvMix;",      // 0 until the first panorama loads
        // Two rotating mesh slots: JS binds whichever baked SDF atlases the
        // current and next shapes need, so the mesh roster is unlimited
        // while the shader only ever holds two samplers.
        "uniform sampler2D uSDFA;",
        "uniform sampler2D uSDFB;",
        "uniform vec2 uGridA;",     // per-mesh atlas layout: (grid N, atlas columns)
        "uniform vec2 uGridB;",
        "uniform float uIdA;",      // shape codes: 0 sphere, 1 torus, 2 octa, 3 mesh A, 4 mesh B
        "uniform float uIdB;",
        "uniform float uMorph;",    // 0 = shape A, 1 = shape B
        "uniform float uGrab;",     // 0 = satellites orbit the form, 1 = they swarm the cursor
        "vec3 gMouse3;",            // cursor unprojected to the sculpture's depth plane

        "mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }",
        "float hash(vec2 v){ return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453); }",

        "float noise(vec2 p){",
        "    vec2 i = floor(p), f = fract(p);",
        "    vec2 u = f*f*(3.0 - 2.0*f);",
        "    return mix(mix(hash(i),                 hash(i + vec2(1.0, 0.0)), u.x),",
        "               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);",
        "}",

        "float fbm(vec2 p){",
        "    float a = 0.5, s = 0.0;",
        "    for (int i = 0; i < 3; i++){ s += a*noise(p); p *= 2.03; a *= 0.5; }",
        "    return s;",
        "}",

        /* ---- environment ---- */
        "vec2 eqUV(vec3 d){",
        "    return vec2(atan(d.z, d.x)*0.1591549 + 0.5, acos(clamp(d.y, -1.0, 1.0))*0.3183099);",
        "}",

        // procedural stand-in until the panorama arrives: gradient + softboxes
        "vec3 envProc(vec3 d){",
        "    vec3 sky = mix(vec3(0.020, 0.024, 0.032), vec3(0.14, 0.16, 0.19), smoothstep(-0.4, 0.8, d.y));",
        "    sky += vec3(1.0, 0.85, 0.62) * pow(max(dot(d, normalize(vec3(-0.5, 0.6, 0.4))), 0.0), 8.0) * 1.6;",
        "    sky += vec3(0.55, 0.70, 0.85) * pow(max(dot(d, normalize(vec3(0.7, 0.2, -0.4))), 0.0), 16.0) * 0.9;",
        "    return sky;",
        "}",

        "vec3 envSample(vec3 d, float lod){",
        "    vec2 uv = eqUV(d);",
        hasLod ? "    vec3 tex = mix(texture2DLodEXT(uEnvTex, uv, lod).rgb, texture2DLodEXT(uEnvTexB, uv, lod).rgb, uEnvFade);"
               : "    vec3 tex = mix(texture2D(uEnvTex, uv).rgb, texture2D(uEnvTexB, uv).rgb, uEnvFade);",
        "    return mix(envProc(d), tex * tex * 1.9, uEnvMix);",  // rough de-gamma for lighting
        "}",

        /* ---- signed distance shapes ---- */
        "float sdTorus(vec3 p){ return length(vec2(length(p.xz) - 0.82, p.y)) - 0.36; }",

        "float sdOcta(vec3 p){",
        "    p = abs(p);",
        "    float s = 1.25;",
        "    float m = p.x + p.y + p.z - s;",
        "    vec3 q;",
        "    if (3.0*p.x < m) q = p;",
        "    else if (3.0*p.y < m) q = p.yzx;",
        "    else if (3.0*p.z < m) q = p.zxy;",
        "    else return m*0.5773503 - 0.10;",
        "    float k = clamp(0.5*(q.z - q.y + s), 0.0, s);",
        "    return length(vec3(q.x, q.y - s + k, q.z - k)) - 0.10;",
        "}",

        /* baked mesh SDF: N^3 grid packed as a COLSxCOLS atlas of z-slices,
           sampled with manual trilinear filtering (bilinear in-slice via
           the sampler, lerp across the two nearest slices here) */
        "float sdfAtlas(sampler2D s, vec3 p, vec2 grid){",
        "    float N = grid.x, C = grid.y;",
        "    vec3 g = clamp((p + 1.2) / 2.4, 0.0, 1.0);",
        "    float zi = g.z * (N - 1.0);",
        "    float z0 = floor(zi);",
        "    float z1 = min(z0 + 1.0, N - 1.0);",
        "    vec2 inUV = (vec2(0.5) + g.xy * (N - 1.0)) / N;",
        "    vec2 uv0 = (vec2(mod(z0, C), floor(z0/C)) + inUV) / C;",
        "    vec2 uv1 = (vec2(mod(z1, C), floor(z1/C)) + inUV) / C;",
        "    float e = mix(texture2D(s, uv0).r, texture2D(s, uv1).r, zi - z0);",
        "    float d = e*1.2 - 0.3;",
        "    vec3 q = abs(p) - vec3(1.2);",             // beyond the grid, add box distance
        "    return d + length(max(q, vec3(0.0)));",
        "}",

        "float sdLink(vec3 p){",
        "    vec3 q = vec3(p.x, max(abs(p.y) - 0.42, 0.0), p.z);",
        "    return length(vec2(length(q.xy) - 0.62, q.z)) - 0.26;",
        "}",

        "float sdFrame(vec3 p){",
        "    p = abs(p) - 0.72;",
        "    vec3 q = abs(p + 0.10) - 0.10;",
        "    float d1 = length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0);",
        "    float d2 = length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0);",
        "    float d3 = length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0);",
        "    return min(min(d1, d2), d3) - 0.05;",
        "}",

        "float sdGyroid(vec3 p){",
        "    float g = abs(dot(sin(p*5.5), cos(p.zxy*5.5)))/5.5 - 0.10;",
        "    return max(length(p) - 1.05, g) * 0.7;",  // conservative: gyroid SDF is approximate
        "}",

        "float shapeSD(vec3 p, float id){",
        "    if (id < 0.5) return length(p) - 1.0;",   // sphere
        "    if (id < 1.5) return sdTorus(p);",
        "    if (id < 2.5) return sdOcta(p);",
        "    if (id < 3.5) return sdfAtlas(uSDFA, p, uGridA);", // mesh slot A
        "    if (id < 4.5) return sdfAtlas(uSDFB, p, uGridB);", // mesh slot B
        "    if (id < 5.5) return sdLink(p);",
        "    if (id < 6.5) return sdFrame(p);",
        "    return sdGyroid(p);",
        "}",

        "float smin(float a, float b, float k){",
        "    float h = clamp(0.5 + 0.5*(b - a)/k, 0.0, 1.0);",
        "    return mix(b, a, h) - k*h*(1.0 - h);",
        "}",

        /* ---- scene: morphing form + metaball satellites ---- */
        "float map(vec3 p){",
        "    vec3 q = p;",
        "    q.xz = rot(uTime*0.14) * q.xz;",                   // slow self-spin
        "    q.yz = rot(sin(uTime*0.06 + uSeed)*0.12) * q.yz;", // lazy tumble (gentle: statues stay upright)

        // the shape sequence and morph timing are driven from JS, which
        // binds the right SDF atlases into the two mesh slots just in time.
        // Outside morph windows only one shape is evaluated — that's ~65%
        // of the time, and shape evaluation dominates the frame cost.
        "    float d;",
        "    if (uMorph < 0.001)      d = shapeSD(q, uIdA);",
        "    else if (uMorph > 0.999) d = shapeSD(q, uIdB);",
        "    else {",
        // inflate mid-morph: barely-overlapping shapes would otherwise
        // vanish (the mixed field goes positive everywhere) — the bulge
        // bridges them so one form always melts into the next
        "        d = mix(shapeSD(q, uIdA), shapeSD(q, uIdB), uMorph)",
        "          - uMorph*(1.0 - uMorph)*1.3;",
        "    }",

        // satellites on true spherical orbits (normalized direction, fixed
        // radius) so they can never wander out and get culled mid-air.
        // While the mouse is active, the first satellite leaves its orbit
        // and rides the cursor (with a little bob), melting into whatever
        // it sweeps across; when idle it drifts back home.
        "    vec3 s1 = normalize(vec3(sin(uTime*0.50), cos(uTime*0.37), sin(uTime*0.43))) * 1.30;",
        "    vec3 held = gMouse3 + 0.10*vec3(sin(uTime*1.7), cos(uTime*2.1), sin(uTime*1.3));",
        "    s1 = mix(s1, held, uGrab);",
        "    vec3 s2 = normalize(vec3(cos(uTime*0.31), sin(uTime*0.53), cos(uTime*0.41))) * 1.42;",
        "    d = smin(d, length(p - s1) - 0.26, 0.45);",
        "    d = smin(d, length(p - s2) - 0.20, 0.45);",
        "    return d;",
        "}",

        "vec3 normalAt(vec3 p){",
        "    vec2 e = vec2(0.004, -0.004);",
        "    return normalize(",
        "        e.xyy*map(p + e.xyy) + e.yyx*map(p + e.yyx) +",
        "        e.yxy*map(p + e.yxy) + e.xxx*map(p + e.xxx));",
        "}",

        "void main(){",
        "    vec2 uv = (gl_FragCoord.xy*2.0 - uRes) / uRes.y;",
        "    float aspect = uRes.x / uRes.y;",
        // landscape: sculpture right of the text; portrait: centered below it
        "    float fit = clamp((aspect - 0.85) / 0.5, 0.0, 1.0);",
        "    vec2 OFF = vec2(0.62*fit, mix(-0.5, 0.02, fit));",

        /* orbiting camera, steered by the mouse */
        "    float ca = uTime*0.08 + uSeed*6.2832 + uMouse.x*0.7;",
        "    float ce = 0.02 + uMouse.y*0.22;",  // near-horizontal orbit keeps verticals vertical
        "    vec3 ro = vec3(sin(ca)*cos(ce), sin(ce), cos(ca)*cos(ce)) * mix(4.5, 3.9, fit);",
        "    vec3 fwd = normalize(-ro);",
        "    vec3 rgt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));",
        "    vec3 up  = cross(fwd, rgt);",
        "    vec2 sv = uv - OFF;",
        "    vec3 rd = normalize(fwd*1.9 + sv.x*rgt + sv.y*up);",

        // unproject the cursor onto the plane through the origin facing the
        // camera: that 3D point carries the mouse metaball
        "    vec2 msv = vec2(uMouse.x*aspect, uMouse.y) - OFF;",
        "    vec3 rdm = normalize(fwd*1.9 + msv.x*rgt + msv.y*up);",
        "    float tm = -dot(ro, fwd) / max(dot(rdm, fwd), 0.2);",
        "    gMouse3 = ro + rdm*tm;",
        "    gMouse3 *= min(1.0, 1.5/max(length(gMouse3), 0.001));",  // keep within reach

        /* backdrop: the environment itself, heavily blurred and dimmed */
        "    vec3 col = envSample(rd, 5.5);",
        "    col = col*0.42 + vec3(0.016, 0.020, 0.028);",

        /* march the sculpture — but only rays that can hit it: everything
           lives inside a radius-2.2 bounding sphere, so rays that miss it
           (most sky pixels) skip the march entirely */
        "    float t = 0.0, d = 1.0;",
        "    float steps = 0.0;",
        "    float b = dot(ro, rd);",
        "    float disc = b*b - dot(ro, ro) + 4.84;",   // 2.2^2
        "    if (disc > 0.0){",
        "        t = max(-b - sqrt(disc), 0.0);",
        "        float tExit = -b + sqrt(disc);",
        "        for (int i = 0; i < 64; i++){",
        "            d = map(ro + rd*t);",
        "            if (d < 0.0025 || t > tExit) break;",
        "            t += d;",
        "            steps += 1.0;",
        "        }",
        "    }",

        "    if (d < 0.0025){",
        "        vec3 p = ro + rd*t;",
        "        vec3 n = normalAt(p);",
        "        float ndv = max(dot(n, -rd), 0.0);",
        "        float ao = clamp(1.15 - steps/48.0, 0.35, 1.0);",

        /* PBR-ish metal, satin finish: fresnel-weighted env reflection by roughness */
        "        float rough = 0.45;",
        "        vec3 F0 = vec3(0.87, 0.88, 0.90);",            // brushed steel
        "        vec3 F = F0 + (1.0 - F0)*pow(1.0 - ndv, 5.0);",
        "        vec3 refl = reflect(rd, n);",
        "        vec3 spec = envSample(refl, rough*10.0);",     // reflection, blur by roughness
        "        vec3 irr  = envSample(n, 6.0);",               // irradiance approximation

        "        vec3 mcol = spec * F * 0.95 + irr * F0 * 0.20;",

        /* analytic key + rim highlights for shape definition */
        "        vec3 L1 = normalize(vec3(-0.5, 0.65, 0.45));",
        "        vec3 h1 = normalize(L1 - rd);",
        "        mcol += vec3(1.0, 0.85, 0.65) * pow(max(dot(n, h1), 0.0), 36.0) * 0.8;",
        "        mcol += vec3(1.0, 0.82, 0.60) * max(dot(n, L1), 0.0) * 0.09;",  // warm wash from the beam side
        "        vec3 L2 = normalize(vec3(0.7, 0.1, -0.5));",
        "        mcol += vec3(0.55, 0.75, 0.95) * pow(1.0 - ndv, 3.0) * max(dot(n, L2), 0.0) * 0.5;",

        "        col = mcol * ao;",
        "    }",

        /* light shafts from the key light's corner: bright through the
           empty air, faint over the sculpture so it reads as haze depth */
        "    vec2 dl = uv - vec2(-1.9, 1.30);",
        "    float ang = atan(dl.y, dl.x);",
        "    float wob = fbm(vec2(ang*6.0 + uTime*0.02, uTime*0.03));",
        "    float shaft = 0.55 + 0.45*sin(ang*24.0 + wob*4.0);",
        "    shaft *= 0.60 + 0.40*sin(ang*9.0 - uTime*0.04 + 2.0);",
        "    shaft = pow(clamp(shaft, 0.0, 1.0), 2.4);",
        "    float fan = smoothstep(-1.15, -0.70, ang) * smoothstep(-0.03, -0.45, ang);",
        "    float rays = shaft * fan * exp(-length(dl)*0.55);",
        "    float rayAmt = (d < 0.0025) ? 0.10 : 0.30;",
        "    col += vec3(1.0, 0.82, 0.58) * rays * rayAmt;",
        "    col += vec3(1.0, 0.88, 0.70) * exp(-length(dl)*1.4) * rayAmt * 0.35;",

        /* tonemap, contrast, vignette, grain */
        "    col = col / (1.0 + col);",
        "    col = pow(col, vec3(1.10));",
        "    float vig = 1.0 - 0.45*dot(uv*0.55, uv*0.55);",
        "    col *= vig;",
        "    col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.012;",

        "    gl_FragColor = vec4(col, 1.0);",
        "}"
    ].join("\n");

    function compile(type, src) {
        var s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(s));
        }
        return s;
    }

    var prog;
    try {
        prog = gl.createProgram();
        gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
        gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(prog));
        }
    } catch (err) {
        return; // CSS gradient fallback remains
    }
    gl.useProgram(prog);

    /* ---- environments: shuffled cycle with crossfades, loaded just in
       time. Only the first panorama is fetched up front; each next one
       loads mid-phase, well before its fade (?env=N pins a single one). ---- */
    var ENVS = ["media/env/studio.jpg", "media/env/sunset.jpg",
                "media/env/dawn.jpg", "media/env/forest.jpg",
                "media/env/mist.jpg", "media/env/snow.jpg"];
    // each environment lingers a random while, so the mood shifts
    // feel organic rather than metronomic
    function envDur() { return 9 + Math.random() * 9; }   // 9-18 s
    var ENV_FADE = 3;                                     // crossfade length
    var forced = location.search.match(/env=(\d+)/);
    var envStart = forced ? (+forced[1]) % ENVS.length
                          : Math.floor(Math.random() * ENVS.length);
    // walk the roster with a random step co-prime to its length,
    // so every environment appears exactly once per lap
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    var steps = [];
    for (var s = 1; s < ENVS.length; s++) if (gcd(s, ENVS.length) === 1) steps.push(s);
    var envStep = forced ? 0 : steps[Math.floor(Math.random() * steps.length)];
    var envTex = {}, envLoading = {};

    var uEnvMix = gl.getUniformLocation(prog, "uEnvMix");
    var uEnvFade = gl.getUniformLocation(prog, "uEnvFade");
    gl.uniform1i(gl.getUniformLocation(prog, "uEnvTex"), 0);
    gl.uniform1i(gl.getUniformLocation(prog, "uEnvTexB"), 3);
    gl.uniform1f(uEnvMix, 0);
    gl.uniform1f(uEnvFade, 0);
    var seedM = location.search.match(/seed=([\d.]+)/);
    var seedVal = seedM ? parseFloat(seedM[1]) : Math.random();
    gl.uniform1f(gl.getUniformLocation(prog, "uSeed"), seedVal);

    function ensureEnv(idx) {
        if (envTex[idx] || envLoading[idx]) return;
        envLoading[idx] = true;
        var img = new Image();
        img.onload = function () {
            var tex = gl.createTexture();
            gl.activeTexture(gl.TEXTURE4);      // scratch unit for uploads
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
            gl.generateMipmap(gl.TEXTURE_2D);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            envTex[idx] = tex;
            wake();
        };
        img.src = ENVS[idx];
    }

    function envAt(k) { return (envStart + k * envStep) % ENVS.length; }

    var envK = 0, envPhaseStart = 0, envPhaseDur = envDur();

    function updateEnv(timeSec) {
        while (timeSec > envPhaseStart + envPhaseDur) {   // advance phases (handles time jumps)
            envPhaseStart += envPhaseDur;
            envPhaseDur = envDur();
            envK++;
        }
        var cur = envAt(envK), nxt = envAt(envK + 1);
        ensureEnv(cur);
        var into = timeSec - envPhaseStart;
        if (envStep !== 0 && into > envPhaseDur * 0.35) ensureEnv(nxt); // fetch well before the fade
        var curReady = !!envTex[cur];
        if (curReady) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, envTex[cur]);
        }
        var fade = 0;
        if (envStep !== 0 && envTex[nxt]) {
            gl.activeTexture(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, envTex[nxt]);
            fade = smooth01((into - (envPhaseDur - ENV_FADE)) / ENV_FADE);
        }
        gl.uniform1f(uEnvMix, curReady ? 1 : 0);
        gl.uniform1f(uEnvFade, fade);
    }

    /* ---- morph sequence: analytic shapes + baked mesh SDFs ----
       JS owns the timing. Mesh atlases are fetched one shape ahead of
       their turn and bound into the shader's two mesh slots, so nothing
       loads up front and the roster can grow freely. */
    // strictly alternating primitive -> model -> primitive, built fresh
    // per visit: models in shuffled order, with a random primitive between
    // each (never the same one twice in a row). Alternation also means the
    // two mesh slots are never both active in one morph — cheapest pattern.
    var ANALYTIC = { sphere: 0, torus: 1, octa: 2, link: 5, frame: 6, gyroid: 7 };
    var MODELS = ["teapot", "bunny", "suzanne", "dragon", "buddha", "armadillo", "lucy"];
    var PRIMS = Object.keys(ANALYTIC);
    // seeded LCG when ?seed= is forced, so debug sequences are reproducible
    var rnd = seedM ? (function (s) {
        return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    })(Math.floor(seedVal * 233279) + 1) : Math.random;
    for (var i = MODELS.length - 1; i > 0; i--) {      // shuffle the models
        var j = Math.floor(rnd() * (i + 1));
        var tmp = MODELS[i]; MODELS[i] = MODELS[j]; MODELS[j] = tmp;
    }
    var SEQ = [];
    var prevPrim = "";
    MODELS.forEach(function (m) {
        var a;
        do { a = PRIMS[Math.floor(rnd() * PRIMS.length)]; } while (a === prevPrim);
        prevPrim = a;
        SEQ.push(a, m);
    });
    var PERIOD = 7;                    // seconds per shape
    var meshTex = {};                  // name -> WebGLTexture (ready)
    var meshLoading = {};

    function ensureMesh(name) {
        if (ANALYTIC.hasOwnProperty(name) || meshTex[name] || meshLoading[name]) return;
        meshLoading[name] = true;
        var img = new Image();
        img.onload = function () {
            var tex = gl.createTexture();
            gl.activeTexture(gl.TEXTURE4);      // scratch unit for uploads
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            meshTex[name] = tex;
            wake();
        };
        img.src = "media/sdf/" + name + ".png";
    }

    var uIdA = gl.getUniformLocation(prog, "uIdA");
    var uIdB = gl.getUniformLocation(prog, "uIdB");
    var uMorph = gl.getUniformLocation(prog, "uMorph");
    var uGridA = gl.getUniformLocation(prog, "uGridA");
    var uGridB = gl.getUniformLocation(prog, "uGridB");
    gl.uniform1i(gl.getUniformLocation(prog, "uSDFA"), 1);
    gl.uniform1i(gl.getUniformLocation(prog, "uSDFB"), 2);

    // per-mesh atlas layout: [grid N, atlas columns]
    var MESH_GRID = { dragon: [128, 12] };
    var GRID_DEFAULT = [96, 10];

    // resolve a sequence entry to a shader shape code, binding its atlas
    // into the given slot (unit 1 = code 3, unit 2 = code 4); shapes whose
    // atlas isn't ready yet render as a sphere until it arrives
    function resolveShape(name, unit) {
        if (ANALYTIC.hasOwnProperty(name)) return ANALYTIC[name];
        if (meshTex[name]) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, meshTex[name]);
            var grid = MESH_GRID[name] || GRID_DEFAULT;
            gl.uniform2f(unit === 1 ? uGridA : uGridB, grid[0], grid[1]);
            return unit === 1 ? 3 : 4;
        }
        return 0; // sphere stand-in
    }

    function smooth01(x) {
        x = Math.min(Math.max(x, 0), 1);
        return x * x * (3 - 2 * x);
    }

    function updateSequence(timeSec) {
        var t4 = timeSec / PERIOD + seedVal;
        var k = Math.floor(t4);
        var f = t4 - k;
        var cur = SEQ[k % SEQ.length];
        var nxt = SEQ[(k + 1) % SEQ.length];
        ensureMesh(cur);                          // safety net (e.g. time jumps)
        ensureMesh(nxt);                          // fetch one shape ahead
        ensureMesh(SEQ[(k + 2) % SEQ.length]);    // and the one after, for slow links
        gl.uniform1f(uIdA, resolveShape(cur, 1));
        gl.uniform1f(uIdB, resolveShape(nxt, 2));
        gl.uniform1f(uMorph, smooth01((f - 0.62) / 0.35));
    }


    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, "uRes");
    var uTime = gl.getUniformLocation(prog, "uTime");
    var uMouse = gl.getUniformLocation(prog, "uMouse");

    // Near-native render (the scene is a cheap single-object march);
    // the adaptive scaler below is the backstop for weak GPUs.
    var SCALE = 0.9;
    var SCALE_MIN = 0.5;
    function resize() {
        var dpr = Math.min(devicePixelRatio || 1, 2);
        var w = Math.max(1, Math.floor(canvas.clientWidth * dpr * SCALE));
        var h = Math.max(1, Math.floor(canvas.clientHeight * dpr * SCALE));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
    }
    addEventListener("resize", resize);
    resize();

    var mouse = { x: 0, y: 0 }, target = { x: 0, y: 0 };
    var uGrab = gl.getUniformLocation(prog, "uGrab");
    var grab = 0, lastMove = -1e9;
    addEventListener("pointermove", function (e) {
        if (e.pointerType === "touch") return;   // touch drags are for scrolling
        target.x = (e.clientX / innerWidth) * 2 - 1;
        target.y = -((e.clientY / innerHeight) * 2 - 1);
        lastMove = performance.now();
    }, { passive: true });
    // debug: ?grab plants the cursor metaball up-right of the sculpture
    if (/[?&]grab/.test(location.search)) {
        target.x = 0.45; target.y = 0.25;
        lastMove = Infinity;
    }

    var reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var heroVisible = true;
    var raf = null;
    var start = performance.now();
    // debug: ?t=SECONDS fast-forwards the animation clock
    var tM = location.search.match(/[?&]t=([\d.]+)/);
    var tOffset = tM ? parseFloat(tM[1]) : 0;

    // adaptive quality: EMA of frame spacing; a sustained average past
    // ~24ms (≈42fps) steps the render scale down and re-measures
    var emaDt = 0, sampled = 0, lastNow = 0;
    function adapt(now) {
        var dt = now - lastNow;
        lastNow = now;
        if (dt <= 0 || dt > 250) { emaDt = 0; sampled = 0; return; } // resumed from pause
        emaDt = emaDt ? emaDt * 0.95 + dt * 0.05 : dt;
        sampled++;
        if (sampled > 90 && emaDt > 24 && SCALE > SCALE_MIN) {
            SCALE = Math.max(SCALE_MIN, SCALE - 0.12);
            emaDt = 0; sampled = 0;
        }
    }

    function frame(now) {
        raf = null;
        adapt(now);
        resize();
        mouse.x += (target.x - mouse.x) * 0.04;
        mouse.y += (target.y - mouse.y) * 0.04;
        var timeSec = (now - start) / 1000 + tOffset;
        updateSequence(timeSec);
        updateEnv(timeSec);
        // the satellite attaches to the cursor quickly, but glides home
        // slowly once the mouse idles or wanders away from the sculpture.
        // Proximity uses the same aspect-aware anchor as the shader.
        var aspect = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
        var fit = Math.min(Math.max((aspect - 0.85) / 0.5, 0), 1);
        var dxm = mouse.x * aspect - 0.62 * fit;
        var dym = mouse.y - (0.02 * fit - 0.5 * (1 - fit));
        var prox = Math.min(Math.max((1.35 - Math.sqrt(dxm*dxm + dym*dym)) / 0.45, 0), 1);
        var grabTarget = (now - lastMove < 2200) ? prox : 0;
        grab += (grabTarget - grab) * (grabTarget > grab ? 0.08 : 0.012);
        gl.uniform1f(uGrab, grab);
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, timeSec);
        gl.uniform2f(uMouse, mouse.x, mouse.y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!reducedMotion && heroVisible && !document.hidden) {
            raf = requestAnimationFrame(frame);
        }
    }

    function wake() {
        if (raf === null && (heroVisible && !document.hidden || reducedMotion)) {
            raf = requestAnimationFrame(frame);
        }
    }

    if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
            heroVisible = entries[0].isIntersecting;
            wake();
        }).observe(canvas);
    }
    document.addEventListener("visibilitychange", wake);

    wake(); // reduced-motion users still get one rendered frame
})();
