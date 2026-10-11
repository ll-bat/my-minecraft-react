#!/usr/bin/env python3
"""Generate compact embedded glTF models and matching inventory previews."""

import base64
import json
import math
import struct
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src/images/game/models"
PREVIEWS = OUTPUT / "previews"

# Cuboids use [minX, maxX, minY, maxY, minZ, maxZ, color]. All models fit one voxel.
MODELS = {
    "chair": [(-.34,.34,-.5,-.38,-.34,.34,"#6d4527"),(-.3,.3,-.08,.04,-.3,.3,"#a56b38"),(-.3,-.22,-.42,-.08,-.3,-.22,"#76502c"),(.22,.3,-.42,-.08,-.3,-.22,"#76502c"),(-.3,-.22,-.42,-.08,.22,.3,"#76502c"),(.22,.3,-.42,-.08,.22,.3,"#76502c"),(-.3,.3,.04,.5,.22,.3,"#8f5b31")],
    "stool": [(-.32,.32,-.05,.08,-.32,.32,"#a56b38"),(-.25,-.16,-.5,-.05,-.25,-.16,"#6d4527"),(.16,.25,-.5,-.05,-.25,-.16,"#6d4527"),(-.25,-.16,-.5,-.05,.16,.25,"#6d4527"),(.16,.25,-.5,-.05,.16,.25,"#6d4527")],
    "wood_table": [(-.48,.48,.12,.24,-.48,.48,"#a66b38"),(-.42,-.32,-.5,.12,-.42,-.32,"#6d4527"),(.32,.42,-.5,.12,-.42,-.32,"#6d4527"),(-.42,-.32,-.5,.12,.32,.42,"#6d4527"),(.32,.42,-.5,.12,.32,.42,"#6d4527")],
    "shelf": [(-.46,-.36,-.5,.5,-.42,.42,"#654025"),(.36,.46,-.5,.5,-.42,.42,"#654025"),(-.46,.46,-.5,-.4,-.42,.42,"#8e5b32"),(-.46,.46,-.08,.02,-.42,.42,"#9e6a3b"),(-.46,.46,.4,.5,-.42,.42,"#b17a45")],
    "cabinet": [(-.46,.46,-.5,.5,-.42,.42,"#87532c"),(-.4,-.02,-.42,.4,-.44,-.4,"#a86c38"),(.02,.4,-.42,.4,-.44,-.4,"#9a6031"),(-.06,-.01,-.05,.02,-.47,-.43,"#d5ba72"),(.01,.06,-.05,.02,-.47,-.43,"#d5ba72")],
    "barrel": [(-.38,.38,-.42,.42,-.38,.38,"#9a6031"),(-.42,.42,-.48,-.38,-.42,.42,"#4d3827"),(-.42,.42,-.04,.05,-.42,.42,"#4d3827"),(-.42,.42,.38,.48,-.42,.42,"#4d3827")],
    "crate": [(-.45,.45,-.45,.45,-.45,.45,"#a86c38"),(-.48,.48,-.48,-.38,-.48,-.4,"#644026"),(-.48,.48,.38,.48,-.48,-.4,"#644026"),(-.48,-.38,-.48,.48,-.48,-.4,"#644026"),(.38,.48,-.48,.48,-.48,-.4,"#644026")],
    "basket": [(-.4,.4,-.46,-.34,-.34,.34,"#b1844c"),(-.4,-.3,-.34,.16,-.34,.34,"#98703f"),(.3,.4,-.34,.16,-.34,.34,"#98703f"),(-.3,.3,-.34,-.24,-.34,-.24,"#b1844c"),(-.3,.3,-.34,-.24,.24,.34,"#b1844c")],
    "flowerpot": [(-.28,.28,-.48,-.18,-.28,.28,"#a95436"),(-.2,.2,-.18,-.08,-.2,.2,"#75412e"),(-.04,.04,-.08,.35,-.04,.04,"#3f7d32"),(-.2,.2,.25,.38,-.05,.05,"#58a447"),(-.05,.05,.32,.48,-.2,.2,"#58a447")],
    "planter": [(-.46,.46,-.48,-.2,-.3,.3,"#8b5730"),(-.4,.4,-.2,-.12,-.24,.24,"#4f3423"),(-.32,-.24,-.12,.38,-.04,.04,"#397239"),(-.04,.04,-.12,.46,-.04,.04,"#4c8a43"),(.24,.32,-.12,.34,-.04,.04,"#397239")],
    "floor_lamp": [(-.25,.25,-.5,-.42,-.25,.25,"#49351f"),(-.045,.045,-.42,.18,-.045,.045,"#755737"),(-.28,.28,.16,.45,-.28,.28,"#e4c56b"),(-.2,.2,.2,.4,-.2,.2,"#fff1a3")],
    "hanging_lantern": [(-.05,.05,.34,.5,-.05,.05,"#6f5635"),(-.2,.2,.22,.34,-.2,.2,"#5d452b"),(-.17,.17,-.25,.22,-.17,.17,"#ffc94f"),(-.22,.22,-.35,-.25,-.22,.22,"#5d452b")],
    "rug": [(-.48,.48,-.49,-.45,-.42,.42,"#a83f4f"),(-.36,.36,-.445,-.43,-.3,.3,"#e0aa58")],
    "wall_art": [(-.42,.42,-.38,.38,.4,.46,"#5a3924"),(-.34,.34,-.3,.3,.38,.4,"#5b92a8"),(-.2,.2,-.18,.05,.36,.38,"#6a9f55"),(-.3,.3,-.3,-.2,.35,.37,"#d6b56a")],
    "rock": [(-.38,.34,-.5,-.18,-.32,.38,"#727675"),(-.24,.4,-.28,.02,-.26,.24,"#858986"),(-.18,.18,-.12,.14,-.18,.18,"#969a95")],
    "bush": [(-.4,.2,-.46,.1,-.38,.3,"#3d7738"),(-.15,.42,-.38,.18,-.28,.4,"#4b8b42"),(-.26,.28,-.12,.34,-.24,.25,"#57964a")],
    "fallen_log": [(-.48,.48,-.42,-.08,-.22,.22,"#74502e"),(-.5,-.44,-.4,-.1,-.24,.24,"#b48650"),(.44,.5,-.4,-.1,-.24,.24,"#b48650")],
    "sign": [(-.4,.4,.04,.42,-.08,.08,"#b07a42"),(-.06,.06,-.5,.04,-.06,.06,"#6b4629"),(-.3,.3,.14,.2,-.09,.09,"#6b4629")],
    "bench": [(-.46,.46,-.05,.08,-.32,.18,"#9e6939"),(-.46,.46,.16,.29,.18,.3,"#8b5932"),(-.38,-.28,-.5,-.05,-.22,-.12,"#5f4028"),(.28,.38,-.5,-.05,-.22,-.12,"#5f4028")],
    "path_marker": [(-.07,.07,-.5,.3,-.07,.07,"#6b4629"),(-.35,.35,.12,.34,-.08,.08,"#b17a45"),(.25,.42,.15,.31,-.08,.08,"#b17a45")],
}

FACES = [
    ((1,0,0), (1,4,7,10)), ((-1,0,0), (0,9,6,3)), ((0,1,0), (3,6,7,4)),
    ((0,-1,0), (0,1,10,9)), ((0,0,1), (9,10,7,6)), ((0,0,-1), (0,3,4,1)),
]


def rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i+2], 16) / 255 for i in (0, 2, 4))


def build_geometry(parts):
    positions, normals, colors, indices = [], [], [], []
    for min_x, max_x, min_y, max_y, min_z, max_z, color in parts:
        corners = [(min_x,min_y,min_z),(max_x,min_y,min_z),(max_x,max_y,min_z),(min_x,max_y,min_z),(max_x,max_y,max_z),(max_x,min_y,max_z),(min_x,max_y,max_z),(min_x,min_y,max_z),(0,0,0),(min_x,min_y,max_z),(max_x,min_y,max_z)]
        face_corners = [
            [(max_x,min_y,min_z),(max_x,min_y,max_z),(max_x,max_y,max_z),(max_x,max_y,min_z)],
            [(min_x,min_y,max_z),(min_x,min_y,min_z),(min_x,max_y,min_z),(min_x,max_y,max_z)],
            [(min_x,max_y,min_z),(max_x,max_y,min_z),(max_x,max_y,max_z),(min_x,max_y,max_z)],
            [(min_x,min_y,max_z),(max_x,min_y,max_z),(max_x,min_y,min_z),(min_x,min_y,min_z)],
            [(min_x,min_y,max_z),(min_x,max_y,max_z),(max_x,max_y,max_z),(max_x,min_y,max_z)],
            [(max_x,min_y,min_z),(max_x,max_y,min_z),(min_x,max_y,min_z),(min_x,min_y,min_z)],
        ]
        base_color = rgb(color)
        for face_index, ((nx,ny,nz), _) in enumerate(FACES):
            start = len(positions) // 3
            shade = 1 if ny > 0 else .78 if nx != 0 else .68 if nz < 0 else .86
            for vertex in face_corners[face_index]:
                positions.extend(vertex); normals.extend((nx,ny,nz)); colors.extend((*[min(1, c*shade) for c in base_color], 1))
            indices.extend((start,start+1,start+2,start,start+2,start+3))
    return positions, normals, colors, indices


def accessor_data(values, kind):
    if kind == "indices": return struct.pack(f"<{len(values)}H", *values), 5123, "SCALAR", len(values)
    size = 4 if kind == "colors" else 3
    return struct.pack(f"<{len(values)}f", *values), 5126, f"VEC{size}", len(values)//size


def write_gltf(name, parts):
    positions, normals, colors, indices = build_geometry(parts)
    payload = bytearray(); views=[]; accessors=[]
    for values, kind in ((positions,"positions"),(normals,"normals"),(colors,"colors"),(indices,"indices")):
        while len(payload) % 4: payload.append(0)
        offset=len(payload); data, component, accessor_type, count=accessor_data(values, kind); payload.extend(data)
        views.append({"buffer":0,"byteOffset":offset,"byteLength":len(data),"target":34963 if kind=="indices" else 34962})
        accessor={"bufferView":len(views)-1,"componentType":component,"count":count,"type":accessor_type}
        if kind == "positions":
            grouped=list(zip(values[::3],values[1::3],values[2::3])); accessor["min"]=[min(v[i] for v in grouped) for i in range(3)]; accessor["max"]=[max(v[i] for v in grouped) for i in range(3)]
        accessors.append(accessor)
    uri="data:application/octet-stream;base64,"+base64.b64encode(payload).decode()
    document={"asset":{"version":"2.0","generator":"my-minecraft-react build_models.py"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"mesh":0,"name":name}],"meshes":[{"name":name,"primitives":[{"attributes":{"POSITION":0,"NORMAL":1,"COLOR_0":2},"indices":3,"material":0}]}],"materials":[{"name":"Shared vertex colors","pbrMetallicRoughness":{"baseColorFactor":[1,1,1,1],"metallicFactor":0,"roughnessFactor":.86}}],"buffers":[{"byteLength":len(payload),"uri":uri}],"bufferViews":views,"accessors":accessors}
    (OUTPUT/f"{name}.gltf").write_text(json.dumps(document,separators=(",",":"))+"\n")


def shade(color, amount):
    r,g,b=rgb(color); return tuple(round(255*max(0,min(1,c*amount))) for c in (r,g,b))+(255,)


def project(x,y,z): return (64+(x-z)*58, 91-y*64+(x+z)*25)


def write_preview(name, parts):
    image=Image.new("RGBA",(128,128),(0,0,0,0)); draw=ImageDraw.Draw(image)
    for min_x,max_x,min_y,max_y,min_z,max_z,color in sorted(parts,key=lambda p:(p[2]+p[3],p[0]+p[1]+p[4]+p[5])):
        top=[project(min_x,max_y,min_z),project(max_x,max_y,min_z),project(max_x,max_y,max_z),project(min_x,max_y,max_z)]
        left=[project(min_x,min_y,min_z),project(min_x,max_y,min_z),project(min_x,max_y,max_z),project(min_x,min_y,max_z)]
        right=[project(max_x,min_y,max_z),project(max_x,max_y,max_z),project(max_x,max_y,min_z),project(max_x,min_y,min_z)]
        draw.polygon(left,fill=shade(color,.7)); draw.polygon(right,fill=shade(color,.84)); draw.polygon(top,fill=shade(color,1.08))
    image.save(PREVIEWS/f"{name}.png",optimize=True)


def main():
    OUTPUT.mkdir(parents=True,exist_ok=True); PREVIEWS.mkdir(parents=True,exist_ok=True)
    for name,parts in MODELS.items(): write_gltf(name,parts); write_preview(name,parts)
    (OUTPUT/"models.json").write_text(json.dumps({"version":1,"models":sorted(MODELS)},indent=2)+"\n")
    print(f"Built {len(MODELS)} low-poly glTF models and previews")


if __name__ == "__main__": main()
