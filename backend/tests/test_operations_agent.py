import pytest

from app.agents import operations_agent


def test_retrieval_returns_section_and_page_citations(tmp_path, monkeypatch):
    monkeypatch.setattr(operations_agent, "KNOWLEDGE_DIRECTORY", tmp_path)
    sop_path = tmp_path / "SOP-OPS-001_production.md"
    sop_path.write_text(
        "# SOP-OPS-001 Production Reporting\n\n"
        "## Page 4\nPage 4\n\n"
        "## 7. Metric Definitions\n"
        "Achievement percentage is actual output divided by approved planned quantity, multiplied by 100. "
        "If planned quantity is zero or unavailable, report N/A and explain why.\n",
        encoding="utf-8",
    )

    evidence = operations_agent.retrieve_sop_evidence("achievement percentage planned quantity")

    assert evidence
    assert evidence[0]["document_id"] == "SOP-OPS-001"
    assert evidence[0]["section"] == "7. Metric Definitions"
    assert evidence[0]["page"] == 4
    assert operations_agent._citations(evidence)[0]["source"] == "SOP-OPS-001, §7. Metric Definitions, p. 4"


def test_upload_saves_document_and_refreshes_okf_index(tmp_path, monkeypatch):
    monkeypatch.setattr(operations_agent, "KNOWLEDGE_DIRECTORY", tmp_path)

    uploaded = operations_agent.save_operations_document(
        "shift-notes.md",
        b"# Shift Notes\n\nProduction data validation procedure and shift handover notes.\n",
    )

    index = (tmp_path / "index.md").read_text(encoding="utf-8")
    listed = operations_agent.list_operations_documents()

    assert uploaded["name"] == "shift-notes.md"
    assert "shift-notes.md" in index
    assert any(document["name"] == "shift-notes.md" for document in listed["documents"])


def test_upload_rejects_unsupported_and_invalid_text_files(tmp_path, monkeypatch):
    monkeypatch.setattr(operations_agent, "KNOWLEDGE_DIRECTORY", tmp_path)

    with pytest.raises(ValueError, match="Allowed file types"):
        operations_agent.save_operations_document("report.docx", b"not supported")

    with pytest.raises(ValueError, match="UTF-8"):
        operations_agent.save_operations_document("report.txt", b"\xff\xfe\x00\x00")

    assert list(tmp_path.iterdir()) == []


@pytest.mark.parametrize("message", ["hi", "Hello!", "good morning", "namaste"])
def test_greeting_gets_a_capability_response(message):
    reply = operations_agent._smalltalk_reply(message)

    assert reply is not None
    assert "indexed Operations SOPs" in reply
    assert "live" not in reply.lower()


def test_one_word_follow_up_asks_for_a_clearer_question():
    reply = operations_agent._smalltalk_reply("what")

    assert reply is not None
    assert "What would you like to know?" in reply
    assert "work-step verification" in reply
