$dir = "d:\extension way\icons"
if (!(Test-Path $dir)) { 
    New-Item -ItemType Directory -Path $dir | Out-Null 
}

Add-Type -AssemblyName System.Drawing

function Create-Icon($size, $path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Draw rounded gradient circle
    $rect = New-Object System.Drawing.Rectangle 1, 1, ($size - 2), ($size - 2)
    $color1 = [System.Drawing.Color]::FromArgb(79, 70, 229)
    $color2 = [System.Drawing.Color]::FromArgb(6, 182, 212)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $color1, $color2, 45
    $g.FillEllipse($brush, $rect)

    $fontSize = [float]($size * 0.45)
    $font = New-Object System.Drawing.Font "Arial", $fontSize
    $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textRect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
    $g.DrawString("W", $font, $textBrush, $textRect, $sf)

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $path"
}

Create-Icon 16 "d:\extension way\icons\icon16.png"
Create-Icon 48 "d:\extension way\icons\icon48.png"
Create-Icon 128 "d:\extension way\icons\icon128.png"
