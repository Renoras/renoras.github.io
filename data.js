window.data = `{
    "intro": {
        "about": {
            "title": "Introduction",
            "body": "<strong><p>I am a computer science master’s graduate with several years of experience in software development using C++. Over the years, I have worked on a few game engines, some of which I have programmed from scratch. I have typically used game engines as testbeds for academic research or to feed my own curiosity (e.g. implementation of rendering techniques, utilization of software patterns for large systems, interoperability of engine modules, etc.). I have also experimented with industry-standard game engines (e.g. Unreal Engine, Unity) by adding features and functionality to their workflows.</p><p>I try to be a generalist when it comes to software engineering (working with game engines is a great way to achieve that ☺). However, in my spare time, I like to study and update my knowledge on the following specialized topics:</p><ul><li>3D Graphics</li><li>Physically-based rendering</li><li>Ray tracing / Path tracing</li><li>Game engine development</li><li>Virtual reality</li><li>3D Mathematics</li></ul>Here are some of the projects I'm proud of...</strong>"
        }
    },
    "projects": [
        {
            "thumbnail": {
                "type": "video/mp4",
                "url": "media/Raygen.mp4",
                "maximizable": true
            },
            "content": {
                "title": "Raygen Engine",
                "secondaryTitle": "Game engine focused on exploring real-time applications of ray tracing",
                "tags": ["C++20", "Vulkan", "GLSL", "Raytracing", "ECS", "CMake"],
                "buttons": [
                    {
                        "text": "Source",
                        "url": "https://github.com/RaygenEngine/Raygen"
                    }
                ],
                "body": "<p>Raygen is a two-person project that has given me the opportunity to experiment with a more modern rendering methodology by using graphics APIs such as Vulkan and D3D12. In this engine, I have applied and tested several graphics techniques, including hybrid ones that combine deferred rendering and raytracing. Through this project, I have gained a lot of experience on game engine design, software design patterns as well as working on large codebases with many external dependencies.</p><p>For a more complete description of the project and the people involved in the development process, the interested reader is encouraged to press the \\\"Source\\\" button.</p>"
            }
        },
        {
            "thumbnail": {
                "type": "video/mp4",
                "url": "media/Kaleido.mp4",
                "maximizable": true
            },
            "content": {
                "title": "Kaleido Engine",
                "secondaryTitle": "Graphics engine that supports creation of multiple renderers that can be hot-swapped in real-time",
                "tags": ["C++17", "Vulkan", "OpenGL", "D3D11", "GLSL", "HLSL", "CMake"],
                "buttons": [
                    {
                        "text": "Source",
                        "url": "https://github.com/RaygenEngine/Kaleido"
                    }
                ],
                "body": "<p>Kaleido is a good starting point for a graphics academic assignment or personal project. It can be used to avoid boilerplate that is usually required for asset loading, level designing functionality, input capture, etc.</p><p>Among other things, this engine offers multithreaded loading and automated caching of assets as well as an easy way to introduce additional loaders for new asset types. Using the existing ImGui based editor the programmer can set up a complex level hierarchy that automatically updates by the engine using a scenegraph structure. Finally, the programmer can implement their own renderers using any graphics API desired, and have them registered for run-time swapping. For example one could register a real-time renderer and a photorealistic pathtracer to be used interchangeably in order to test the visual fidelity of the former.</p>"
            }
        },
        {
            "thumbnail": {
                "type": "video/mp4",
                "url": "media/SPT.mp4",
                "maximizable": true
            },
            "content": {
                "title": "Stochastic Pathtracer",
                "secondaryTitle": "Pathtracer used to generate fast photorealistic results for Raygen",
                "tags": ["Raygen Engine", "Pathtracing", "NEE", "MIS", "BSDF"],
                "buttons": [
                    {
                        "text": "Source",
                        "url": "https://github.com/RaygenEngine/Raygen/tree/master/assets/engine-data/spv/pathtrace/stochastic"
                    }
                ],
                "body": "<p>Backward tracing, single path, Monte Carlo pathtracer. Uses next event estimation and multiple importance sampling to achieve faster convergence. Evaluates diffuse and specular BRDFs and BTDFs on each interface to cover a wide range of materials. After a specific number of bounces, Russian roulette termination is applied to reduce the cost of evaluating insignificant samples while maintaining a mathematically unbiased result.</p>"            }
        },
        {
            "thumbnail": {
                "type": "video/mp4",
                "url": "media/IBLIRS.mp4",
                "maximizable": true
            },
            "content": {
                "title": "Irradiance Grid",
                "secondaryTitle": "Probe grid created to account for Raygen's diffuse global illumination",
                "tags": ["Raygen Engine", "IBL", "Pathtracing"],
                "buttons": [
                    {
                        "text": "Source1",
                        "url": "https://github.com/RaygenEngine/Raygen/blob/master/assets/engine-data/spv/compute/irradiance.comp"
                    },
                    {
                        "text": "Source2",
                        "url": "https://github.com/RaygenEngine/Raygen/blob/master/assets/engine-data/spv/includes/radiance.glsl#L164"
                    }
                ],
                "body": "<p>Variable sized axis-aligned grid of equidistant probes. The grid structure consists of an array of low-resolution cubemaps that correspond to each probe. When built, probes capture their surrounding lighting information using Raygen's stochastic pathtracer and store them into their respective cubemap.</p><p>At a later stage, global diffuse lighting of a surface affected by the grid is calculated by interpolating data from several nearby probes similarly to how a 3D texture would be sampled with bilinear interpolation. The normal of the surface is reprojected to account for the difference in position between the probes involved and the surface's point.</p>"
            }
        },
        {
            "thumbnail": {
                "type": "video/mp4",
                "url": "media/RTQ.mp4",
                "maximizable": true
            },
            "content": { 
                "title": "Raytraced Area Lights",
                "secondaryTitle": "Raygen's real-time area lights",
                "tags": ["Raygen Engine", "Raytracing", "SVGF", "Representative Point Method" ],
                "buttons": [
                    {
                        "text": "Source1",
                        "url": "https://github.com/RaygenEngine/Raygen/tree/master/assets/engine-data/spv/raytrace/arealights"
                    },
                    {
                        "text": "Source2",
                        "url": "https://github.com/RaygenEngine/Raygen/tree/master/assets/engine-data/spv/svgf"
                    },
                    {
                        "text": "Source3",
                        "url": "https://github.com/RaygenEngine/Raygen/blob/master/assets/engine-data/spv/includes/radiance.glsl#L228"
                    },
                    {
                        "text": "Bib1",
                        "url": "https://wickedengine.net/2017/09/07/area-lights/"
                    },
                    {
                        "text": "Bib2",
                        "url": "https://cg.ivd.kit.edu/publications/2017/svgf/svgf_preprint.pdf"
                    }
                ],
                "body": "<p>This technique consists of two parts. For the first part, the area light shadowing is calculated using several raytracing visibility queries. To remain temporally stable, the results are filtered using an SVGF approach.</p><p>The second part of this technique uses the representative point method to account for the specular highlights created by an area light source. If the surface's reflection vector intersects with the light mesh we use this as our light vector, otherwise, we use the vector between our surface point and the point closest to the reflection vector (smallest required rotation). Putting this new light vector in our direct specular BRDF calculations gives us a decent approximation of the specular highlight produced by the light mesh.</p>"
            }
        },
        {
            "thumbnail": {
                "type": "video/mp4",
                "url": "media/SKY.mp4",
                "maximizable": true
            },
            "content": {
                "title": "Sunlight Scattering",
                "secondaryTitle": "Raygen's color of the sky simulation",
                "tags": ["Raygen Engine", "Ray-marching"],
                "buttons": [ 
                    {
                        "text": "Source",
                        "url": "https://github.com/RaygenEngine/Raygen/blob/master/assets/engine-data/spv/includes/sky.glsl"
                    },
                    {
                        "text": "Bib1",
                        "url": "https://www.scratchapixel.com/lessons/procedural-generation-virtual-worlds/simulating-sky/simulating-colors-of-the-sky"
                    },
                    {
                        "text": "Bib2",
                        "url": "https://hal.inria.fr/file/index/docid/288758/filename/article.pdf"
                    }
                ],
                "body": "<p>This technique calculates the sky color for Raygen's scenes. It is a photorealistic ray-marching approach that can accurately render skies based on several scattering coefficients and astronomical information. Uses Rayleigh and Mie scattering to calculate the effect of air molecules and aerosols on light cast on the planet by any stars involved. Shader depicted uses earth-like data. The shader could be easily parameterized to calculate several scenarios such as urban atmospheres, alien skies, etc.</p>"
            }
        },
        {
            "thumbnail": {
                "type": "video/mp4",
                "url": "media/SM.mp4",
                "maximizable": true
            },
            "content": {
                "title": "Lens-matched Sampling",
                "secondaryTitle": "Technique that was part of my master thesis",
                "tags": ["C++14", "OculusSDK", "OptiX6.0", "Virtual Reality", "Raytracing", "CMake"],
                "buttons": [
                    {
                        "text": "PDF",
                        "url": "pdf/mthesis.pdf"
                    }
                ],
                "body": "<p>Many techniques take advantage of lens distortion caused by VR headsets or use foveated rendering optimizations to reduce frame calculation times. Lens-matched Sampling attempts to apply similar principles to a raytracing context. It uses a different sampling rate based on an adjustable mask to reduce the total number of generated rays required to approximate global illumination.</p><p>A suggested improvement to this technique would be Lens-matched Ray Generation (LMRG). An implementation of LMRG would densely generate rays closer to the center of the eye's focus and a thinner distribution on the periphery. Knowing the exact lens and HMD properties, one could theoretically match the exact lens distortion from any HMD to avoid any efficiency losses.</p>"
            }
        },
        {
            "thumbnail": {
                "type": "video/mp4",
                "url": "media/VL.mp4",
                "maximizable": true
            },
            "content": {
                "title": "Volumetric Lighting",
                "secondaryTitle": "Technique that was part of my graduate thesis",
                "tags": ["C++11", "XEngine", "OpenGL", "GLSL", "Ray-marching", "SVN"],
                "buttons": [
                    {
                        "text": "XEngine",
                        "url": "http://graphics.cs.aueb.gr/graphics/downloads/xenginedoc/XEngine.html"
                    },
                    {
                        "text": "PDF",
                        "url": "pdf/gthesis.pdf"
                    }
                ],
                "body": "<p>This post-process ray-marching technique simulates light scattering as it passes through a medium where interaction with participating media takes place. This effect is responsible for the appearance of light shafts otherwise known as God rays.</p><p>The most important optimization was to distinguish the volume covered by the light in 3D space. This light volume is defined as the space in which light constantly travels through and occupies a 3D integral of a potentially ever-changing and complicated geometrical arrangement. Results showed that the ray-marched line segment bounded only by the light's influence volume achieved far greater performance and similar visual fidelity to a non-clipped ray that used 10x times the sample count of the former.</p>"
            }
        },
        {
            "thumbnail": {
                "type": "video/mp4",
                "url": "media/AB.mp4",
                "maximizable": true
            },
            "content": {
                "title": "Asteroid Blaster",
                "secondaryTitle": "Graduate computer graphics assignment",
                "tags": ["C++11", "OpenGL", "GLSL"],
                "buttons": [
                    {
                        "text": "Award",
                        "url": "http://graphics.cs.aueb.gr/graphics/media/cg2017.mp4"
                    }
                ],
                "body": "<p>A game development assignment for a graduate-level graphics class. In this project, I was an integral part of game design and direction. I coded in a variety of special abilities and their audiovisual representation inside the game. Moreover, I implemented realistic movement for the game objects/actors and worked on meteor and item spawning, physics and boss AI. As for rendering, I added smooth shadows, depth of field, bloom, and normal mapping.</p><p>Asteroid blasters was a very fun team project and an excellent introduction to the world of graphics, 3D world simulation, and game development. Since we managed to get all the available extra credits and also add much more content than was originally required, our work was awarded with the title of the \\\"Best Graphics Project\\\" for the year 2016.</p>"
            }
        }
    ],
    "contact": {
        "title": "Links",
        "body":  "<a href='mailto: ioansmoschos@gmail.com'>ioansmoschos@gmail.com</a><br><a href='https://linkedin.com/in/john-moschos-829bbb205' target='_blank'>https://linkedin.com/in/john-moschos-829bbb205</a><br><a href='https://github.com/Renoras' target='_blank'>https://github.com/Renoras</a>",
        "linkedIn": {

        }
    },
    "cv": {
        "url": "pdf/cv.pdf"
    },    
    "headText": "John Moschos",
    "footer": "Copyright © John Moschos"
}`