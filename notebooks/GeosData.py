#!/usr/bin/python
import sys
import sqlite3
conn = sqlite3.connect("GEOS.db")
conn.text_factory = str
c = conn.cursor()

def create():
    import sqlite3
    conn = sqlite3.connect("GEOS.db")
    conn.text_factory = str
    c = conn.cursor()
    c.execute("CREATE VIRTUAL TABLE PROJECT using FTS4 (input)")
    conn.commit()
    text = "Database Created"
    return text

def insert(data):
    import sqlite3
    conn = sqlite3.connect("GEOS.db")
    conn.text_factory = str
    c = conn.cursor()    
    c.execute("INSERT into PROJECT values (?)", (data,))
    #for row in c.execute("SELECT ROWID,* FROM PROJECT ORDER BY ROWID DESC LIMIT 1"):
    #    print ("\nPOST VERIFIED:\n",row[0],row[1])
    conn.commit()
    conn.close()
    return #data

def search(data):
    import sqlite3
    conn = sqlite3.connect("GEOS.db")
    conn.text_factory = str
    c = conn.cursor()    
    for row in c.execute("SELECT ROWID,* FROM PROJECT WHERE input MATCH ?",(data,)):
        print ("\nINFO Found Here:\n",row[0],row[1])
    conn.commit()
    conn.close()
    return data

def delete(rowid):
    import sqlite3
    conn = sqlite3.connect("GEOS.db")
    conn.text_factory = str
    c = conn.cursor()    
    c.execute("DELETE FROM PROJECT WHERE rowid = ?", (rowid,))
    conn.commit()
    conn.close()
    text = "ROWID "+rowid+" Deleted"
    return text

def main():
    conn = sqlite3.connect("GEOS.db")
    conn.text_factory = str
    c = conn.cursor()
    for row in c.execute("SELECT rowid, * FROM PROJECT"):
        print (row[0],": ",row[1])

def Dsearch():
    conn = sqlite3.connect("GEOS.db")
    conn.text_factory = str
    search = input("Detail Search: ")
    c = conn.cursor()
    for row in c.execute("SELECT rowid, * FROM PROJECT"):
        if search in row[1]:
            print (row[0],": ",row[1])

def prtmain(filename):
    fn = open(filename, "w")
    conn = sqlite3.connect("GEOS.db")
    conn.text_factory = str
    c = conn.cursor()
    for row in c.execute("SELECT rowid, * FROM PROJECT"):
        TEXT = "id:"+str(row[0])+"\n"+str(row[1])
        TEXT = str(TEXT)
        TEXT = TEXT.replace('\\n','\n')
        TEXT = "".join(TEXT)
        fn.write(TEXT+'\n----\n')

def HELP():
    TXT = """
    HELP()
    main()

    insert(data)
    
    delete(rowid)
    search(data)
    print ("Exact Text SEARCH.")
    Dsearch()
    prtmain(filename)
    create()
    """
    print (TXT)

