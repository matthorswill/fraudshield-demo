import os
print(">>> Starting image generation...")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Ensure Next.js public folder exists (frontend/public)
pub = os.path.join(os.getcwd(), "frontend", "public")
os.makedirs(pub, exist_ok=True)
print(f">>> Using output folder: {pub}")

def save_plot(path):
    print(f">>> Saving: {path}")
    plt.savefig(path)
    plt.close()

# Graph Alpha
plt.figure(figsize=(6,4))
plt.scatter([0,1,0.5],[0.5,0.5,1], s=400)
plt.text(0,0.55,"Société Alpha",ha="center")
plt.text(1,0.55,"Offshore Inc",ha="center")
plt.text(0.5,1.05,"Prête-nom A",ha="center")
plt.arrow(0.1,0.5,0.7,0, head_width=0.05, length_includes_head=True)
save_plot(os.path.join(pub,"graph-alpha.png"))

# Graph Media
plt.figure(figsize=(6,4))
plt.plot([1,2,3,4,5],[0,1,3,4,6])
plt.title("Mentions presse/dark web - Client X")
save_plot(os.path.join(pub,"graph-media.png"))

# Graph Beta
plt.figure(figsize=(6,4))
plt.bar(["T1","T2","T3","T4"], [100,120,95,110])
plt.title("Transactions Entreprise Beta")
save_plot(os.path.join(pub,"graph-beta.png"))

print(">>> DONE. Check the 'public' folder.")
