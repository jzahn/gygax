export function wrapEmail(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gygax</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=IM+Fell+English&family=Spectral:wght@400;600&display=swap');

    body {
      margin: 0;
      padding: 0;
      background-color: #2a2a2a;
      font-family: 'Spectral', Georgia, serif;
    }

    .wrapper {
      padding: 40px 20px;
    }

    .container {
      max-width: 500px;
      margin: 0 auto;
      background-color: #F5F0E1;
      border: 3px solid #1a1a1a;
      box-shadow: 8px 8px 0 #1a1a1a;
    }

    .header {
      padding: 30px 40px 20px;
      text-align: center;
      border-bottom: 2px solid #1a1a1a;
    }

    .header h1 {
      margin: 0;
      font-family: 'IM Fell English', Georgia, serif;
      font-size: 32px;
      font-weight: normal;
      color: #1a1a1a;
      letter-spacing: 4px;
    }

    .content {
      padding: 30px 40px;
      color: #1a1a1a;
      font-size: 16px;
      line-height: 1.6;
    }

    .content p {
      margin: 0 0 20px;
    }

    .button-container {
      text-align: center;
      margin: 30px 0;
    }

    .button {
      display: inline-block;
      padding: 14px 28px;
      background-color: #1a1a1a;
      color: #F5F0E1 !important;
      text-decoration: none;
      font-family: 'IM Fell English', Georgia, serif;
      font-size: 16px;
      letter-spacing: 1px;
      border: none;
    }

    .button:hover {
      background-color: #333;
    }

    .note {
      font-size: 14px;
      color: #666;
      font-style: italic;
    }

    .footer {
      padding: 20px 40px;
      text-align: center;
      border-top: 2px solid #1a1a1a;
      font-size: 14px;
      color: #666;
    }

    .divider {
      text-align: center;
      color: #1a1a1a;
      letter-spacing: 2px;
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>GYGAX</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        The Guild Registry
      </div>
    </div>
  </div>
</body>
</html>
`
}
