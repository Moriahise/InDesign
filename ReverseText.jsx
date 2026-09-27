//ReverseText.jsx
//An InDesign Javascript that reverses the order of any selected text.
//If no text is selected with the Type tool, nothing happens.
//Written by Peter Kahrel for InDesignSecrets.com
//****************

#target indesign
if ( "TextWordLineParagraph".search ( app.selection[0].constructor.name ) < 0 )
	exit();
s = app.selection[0].contents;
s = s.split("").reverse().join("");
app.selection[0].contents = s;
