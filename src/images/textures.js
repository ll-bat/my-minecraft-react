import {NearestFilter, RepeatWrapping, TextureLoader} from "three";
import {
    dirtImg,
    glassImg,
    grassImg,
    logImg,
    woodImg
} from "./images"

const dirtTexture = new TextureLoader().load(dirtImg)
const glassTexture = new TextureLoader().load(glassImg)
const grassTexture = new TextureLoader().load(grassImg)
const logTexture = new TextureLoader().load(logImg)
const woodTexture = new TextureLoader().load(woodImg)
const groundTexture = new TextureLoader().load(grassImg)

dirtTexture.magFilter = NearestFilter
glassTexture.magFilter = NearestFilter
grassTexture.magFilter = NearestFilter
logTexture.magFilter = NearestFilter
woodTexture.magFilter = NearestFilter
groundTexture.magFilter = NearestFilter
groundTexture.wrapS = RepeatWrapping
groundTexture.wrapT = RepeatWrapping
groundTexture.repeat.set(100, 100)

export {
    dirtTexture,
    glassTexture,
    grassTexture,
    logTexture,
    woodTexture,
    groundTexture
}
