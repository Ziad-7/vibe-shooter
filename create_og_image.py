from PIL import Image

# Create a 1200x630 dark rectangular background (Twitter/WhatsApp optimal size)
bg = Image.new('RGB', (1200, 630), color=(20, 10, 30)) # Dark purple/void background
logo = Image.open('logo.png').convert("RGBA")

# Resize the circular logo to be large and prominent
new_size = 400
logo = logo.resize((new_size, new_size), Image.Resampling.LANCZOS)

# Calculate center position
offset = ((1200 - new_size) // 2, (630 - new_size) // 2)

# Paste the logo with transparency mask onto the background
bg.paste(logo, offset, mask=logo)

# Save as og-image.png
bg.save('og-image.png', optimize=True, quality=90)
print("Saved og-image.png")
